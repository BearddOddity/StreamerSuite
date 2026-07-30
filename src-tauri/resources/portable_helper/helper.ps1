# StreamerSuite standalone overlay helper (Windows).
#
# Runs entirely on PowerShell + .NET, both already part of Windows -- no
# separate install needed. Serves this folder's overlay.html (and any other
# overlay folder that registers with it -- see "Shared helper" below), hosts
# a local setup page to connect your own Twitch/Kick/YouTube/Chaturbate/
# Streamer.bot/Joystick.tv, and polls/relays those platforms on your behalf
# so bound fields/alerts stay live.
#
# Shared helper: if you've been given more than one StreamerSuite overlay,
# you only ever need ONE of these running at a time. When a second (or
# third...) overlay's helper.ps1 is launched, it notices one is already
# running, hands its own folder over to it, and exits -- the already-running
# one then serves every overlay you've registered, at its own URL, off the
# same port, sharing one set of connected credentials. The registry pointer
# lives at %USERPROFILE%\.streamersuite_portable_helper.json. Alerts are
# scoped per-overlay (see Push-Alert) -- an overlay only ever receives an
# alert from a platform its OWN manifest.json actually lists.
#
# Kick's polling connection (channel slug + token) only gives live viewer
# count/status -- no follower/sub totals via that path. Kick DOES push real
# follow/sub/tip events via webhooks, but only to a public URL, which this
# loopback-only helper isn't -- see the Kick card's "Real-time alerts"
# section for the tunnel-URL workaround, and the /kick-webhook route for
# why it's not signature-verified yet (docs.kick.com was unreachable while
# building this). Joystick.tv needs its own OAuth app (PKCE, no client
# secret) registered by the recipient, using this helper's own port as the
# redirect URI -- see the Joystick.tv card's own copy on the setup page.
# Streamer.bot relays both chat and real alerts (its own built-in triggers
# plus any "Custom" event a Streamer.bot Action broadcasts).
#
# This is provided as-is by whoever gave you this overlay; troubleshooting
# isn't guaranteed. See README.txt for setup steps.
#
# NOTE: unlike the Mac/Linux helper.py twin, this script hasn't been run
# under a real PowerShell interpreter to verify it -- it's been hand-reviewed
# carefully for syntax/logic but not execution-tested.

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $Here "manifest.json"
$OverlayPath = Join-Path $Here "overlay.html"

$HomeDir = $env:USERPROFILE
$RegistryPath = Join-Path $HomeDir ".streamersuite_portable_helper.json"
$RegisteredDirsPath = Join-Path $HomeDir ".streamersuite_portable_helper_overlays.json"
$CredentialsPath = Join-Path $HomeDir ".streamersuite_portable_helper_credentials.json"

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Port = [int]$Manifest.port
if (-not $Port) { $Port = 8420 }

$Global:LiveData = @{}
# overlayId -> ArrayList of queued alerts, NOT one shared queue -- see
# Push-Alert below.
$Global:AlertQueues = @{}
$Global:TwitchStatus = "disconnected"
$Global:TwitchError = ""
$Global:KickStatus = "disconnected"
$Global:KickError = ""
$Global:YoutubeStatus = "disconnected"
$Global:YoutubeError = ""
$Global:ChaturbateStatus = "disconnected"
$Global:ChaturbateError = ""
$Global:StreamerbotStatus = "disconnected"
$Global:StreamerbotError = ""
$Global:JoystickStatus = "disconnected"
$Global:JoystickError = ""
# In-flight PKCE state for the OAuth login currently underway (if any) --
# a single in-memory attempt at a time is enough for this local-only flow.
$Global:JoystickOAuthState = $null
$Global:JoystickOAuthVerifier = $null
$Global:LastFollowerId = $null
$Global:LastYoutubeCycle = $null
$Global:LastChaturbateStamp = $null
$Global:LastJoystickStamp = $null
$Global:LastStreamerbotStamp = $null
# Absolute paths of every overlay folder currently being served -- always
# includes $Here (this folder), plus any other folder that registered with
# this process.
$Global:RegisteredDirs = New-Object System.Collections.ArrayList
$Global:RegisteredDirs.Add($Here) | Out-Null

function Load-Credentials {
    if (-not (Test-Path $CredentialsPath)) { return @{} }
    try {
        $raw = Get-Content $CredentialsPath -Raw
        $obj = $raw | ConvertFrom-Json
        $h = @{}
        $obj.PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value }
        return $h
    } catch {
        return @{}
    }
}

function Save-Credentials($creds) {
    $existing = Load-Credentials
    foreach ($key in $creds.Keys) { $existing[$key] = $creds[$key] }
    ($existing | ConvertTo-Json) | Set-Content -Path $CredentialsPath -Encoding UTF8
}

# --- Joystick.tv: OAuth PKCE (RFC 7636) + ActionCable gateway ---
# Every URL, header, and message shape below is copied from StreamerSuite's
# own verified Joystick integration -- the PKCE authorize/token flow in
# src-tauri/src/multichat.rs's oauth_login (a genuine public PKCE client, no
# client_secret, checked against Joystick's own reference client at
# github.com/joysticktv/jtv), and the ActionCable gateway connect/subscribe/
# tip-parsing logic in src/apps/alerts-hub/useAlertsFeed.ts.
function ConvertTo-Base64Url($Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-JoystickCodeVerifier {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return ConvertTo-Base64Url $bytes
}

function Get-JoystickCodeChallenge($Verifier) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Verifier))
        return ConvertTo-Base64Url $hash
    } finally {
        $sha.Dispose()
    }
}

function Get-JoystickRedirectUri($Port) {
    return "http://127.0.0.1:$Port/joystick-oauth-callback"
}

function Persist-RegisteredDirs {
    (@($Global:RegisteredDirs) | ConvertTo-Json) | Set-Content -Path $RegisteredDirsPath -Encoding UTF8
}

function Load-ManifestFor($DirPath) {
    $p = Join-Path $DirPath "manifest.json"
    if (-not (Test-Path $p)) { return $null }
    try {
        return Get-Content $p -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

# {overlayId: @{dir=DirPath; manifest=Manifest}} for every currently-
# registered, still-readable overlay folder -- a folder the recipient later
# deleted or moved just silently drops out rather than crashing the helper.
function Get-RegisteredManifests {
    $out = @{}
    foreach ($d in @($Global:RegisteredDirs)) {
        $m = Load-ManifestFor $d
        if ($m -and $m.overlayId) { $out[$m.overlayId] = @{ dir = $d; manifest = $m } }
    }
    return $out
}

function Push-Alert($Platform, $Alert) {
    # Queues $Alert (came from $Platform) onto every currently-registered
    # overlay whose OWN manifest.json lists that platform -- never a single
    # shared queue, so e.g. a YouTube Super Chat never reaches an overlay
    # that only declared Twitch.
    foreach ($pair in (Get-RegisteredManifests).GetEnumerator()) {
        if ($pair.Value.manifest.platforms -contains $Platform) {
            $overlayId = $pair.Key
            if (-not $Global:AlertQueues.ContainsKey($overlayId)) {
                $Global:AlertQueues[$overlayId] = New-Object System.Collections.ArrayList
            }
            $Global:AlertQueues[$overlayId].Add($Alert) | Out-Null
        }
    }
}

# Event type strings and general shape are best-effort -- assembled from
# public discussion of Kick's webhook events (channel.followed,
# channel.subscription.new/renewal/gifts, kicks.gifted), not verified
# against docs.kick.com directly (unreachable -- see the "NOT
# SIGNATURE-VERIFIED" comment at the /kick-webhook route). The exact JSON
# field names for the user who triggered the event aren't confirmed, so
# this tries several plausible nested paths defensively rather than
# assuming one.
$Script:KickEventKind = @{
    "channel.followed" = "follow"
    "channel.subscription.new" = "sub"
    "channel.subscription.renewal" = "sub"
    "channel.subscription.gifts" = "sub"
    "kicks.gifted" = "tip"
}
$Script:KickEventMessage = @{
    "channel.followed" = "just followed!"
    "channel.subscription.new" = "subscribed!"
    "channel.subscription.renewal" = "resubscribed!"
    "channel.subscription.gifts" = "gifted subs!"
    "kicks.gifted" = "sent Kicks!"
}

function Get-KickWebhookAlert($EventType, $Body) {
    if (-not $EventType -or -not $Script:KickEventKind.ContainsKey($EventType)) { return $null }
    $user = $null
    if ($Body) {
        foreach ($field in @("follower", "subscriber", "gifter", "user", "broadcaster")) {
            if ($Body.$field -and $Body.$field.username) {
                $user = $Body.$field.username
                break
            }
        }
    }
    if (-not $user) { $user = "Someone" }
    return @{ kind = $Script:KickEventKind[$EventType]; user = $user; message = $Script:KickEventMessage[$EventType] }
}

function Test-AnyPlatform($Platform) {
    foreach ($entry in (Get-RegisteredManifests).Values) {
        if ($entry.manifest.platforms -contains $Platform) { return $true }
    }
    return $false
}

# If a shared helper is already running (per the registry pointer file) and
# actually answers, hand this overlay's own folder to it and return $true so
# the caller can exit without binding a second server. A stale registry
# (process no longer running) is treated the same as no registry at all --
# this process goes on to become the shared helper.
function Try-JoinExistingHelper {
    if (-not (Test-Path $RegistryPath)) { return $false }
    try {
        $registry = Get-Content $RegistryPath -Raw | ConvertFrom-Json
    } catch {
        return $false
    }
    if (-not $registry.port) { return $false }
    try {
        $ping = Invoke-RestMethod -Uri "http://127.0.0.1:$($registry.port)/ping" -Method Get -TimeoutSec 3
        if (-not $ping.ok) { return $false }
    } catch {
        return $false
    }
    try {
        $body = @{ dir = $Here } | ConvertTo-Json
        Invoke-RestMethod -Uri "http://127.0.0.1:$($registry.port)/register" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 3 | Out-Null
        Write-Host "A StreamerSuite helper is already running for you at http://127.0.0.1:$($registry.port)/setup"
        Write-Host "This overlay has been added to it -- open that URL to see it and connect your accounts."
        return $true
    } catch {
        return $false
    }
}

function Start-PollLoop {
    # Runs on a background runspace so it never blocks the HTTP listener
    # below -- polls every ~30s using whatever the shared credentials file
    # currently holds. Unlike helper.py, this job always polls both
    # platforms when credentials for them are present (rather than first
    # checking whether any registered overlay actually needs them) -- a
    # deliberate simplification, since the background job runs in its own
    # runspace without easy access to the live $Global:RegisteredDirs list.
    Start-Job -ScriptBlock {
        param($CredentialsPath, $StatePath)
        $youtubeChatPageToken = $null
        $cycle = 0
        while ($true) {
            $cycle += 1
            $state = @{
                twitchStatus = "disconnected"; twitchError = ""
                kickStatus = "disconnected"; kickError = ""
                youtubeStatus = "disconnected"; youtubeError = ""
                liveData = @{}; newFollow = $null; youtubeAlerts = @(); cycle = $cycle
            }
            $creds = @{}
            if (Test-Path $CredentialsPath) {
                try {
                    $obj = Get-Content $CredentialsPath -Raw | ConvertFrom-Json
                    $obj.PSObject.Properties | ForEach-Object { $creds[$_.Name] = $_.Value }
                } catch { }
            }

            $token = $creds["twitchToken"]
            $clientId = $creds["twitchClientId"]
            if ($token -and $clientId) {
                try {
                    $state.twitchStatus = "connecting"
                    $headers = @{ "Authorization" = "Bearer $token"; "Client-Id" = $clientId }
                    $users = Invoke-RestMethod -Uri "https://api.twitch.tv/helix/users" -Headers $headers -Method Get -TimeoutSec 10
                    $broadcasterId = $users.data[0].id
                    if ($broadcasterId) {
                        $streams = Invoke-RestMethod -Uri "https://api.twitch.tv/helix/streams?user_id=$broadcasterId" -Headers $headers -Method Get -TimeoutSec 10
                        $state.liveData["viewers"] = if ($streams.data.Count -gt 0) { $streams.data[0].viewer_count } else { 0 }

                        try {
                            $followers = Invoke-RestMethod -Uri "https://api.twitch.tv/helix/channels/followers?broadcaster_id=$broadcasterId&first=1" -Headers $headers -Method Get -TimeoutSec 10
                            $state.liveData["followers"] = $followers.total
                            if ($followers.data.Count -gt 0) {
                                $state.newFollow = @{ id = $followers.data[0].user_id; name = $followers.data[0].user_name }
                            }
                        } catch { }

                        try {
                            $subs = Invoke-RestMethod -Uri "https://api.twitch.tv/helix/subscriptions?broadcaster_id=$broadcasterId" -Headers $headers -Method Get -TimeoutSec 10
                            $state.liveData["subscribers"] = $subs.total
                        } catch { }

                        $state.twitchStatus = "connected"
                    }
                } catch {
                    $state.twitchStatus = "error"
                    $state.twitchError = $_.Exception.Message
                }
            }

            $kickToken = $creds["kickToken"]
            $kickSlug = $creds["kickSlug"]
            if ($kickToken -and $kickSlug) {
                try {
                    $state.kickStatus = "connecting"
                    $kickHeaders = @{ "Authorization" = "Bearer $kickToken" }
                    $channels = Invoke-RestMethod -Uri "https://api.kick.com/public/v1/channels?slug=$([uri]::EscapeDataString($kickSlug))" -Headers $kickHeaders -Method Get -TimeoutSec 10
                    if ($channels.data.Count -gt 0) {
                        $stream = $channels.data[0].stream
                        $state.liveData["kick_viewers"] = if ($stream) { $stream.viewer_count } else { 0 }
                        $state.liveData["kick_live"] = if ($stream) { [bool]$stream.is_live } else { $false }
                    }
                    $state.kickStatus = "connected"
                } catch {
                    $state.kickStatus = "error"
                    $state.kickError = $_.Exception.Message
                }
            }

            $youtubeApiKey = $creds["youtubeApiKey"]
            $youtubeChannelId = $creds["youtubeChannelId"]
            if ($youtubeApiKey -and $youtubeChannelId) {
                try {
                    $state.youtubeStatus = "connecting"
                    $search = Invoke-RestMethod -Uri "https://www.googleapis.com/youtube/v3/search?part=id&channelId=$youtubeChannelId&eventType=live&type=video&key=$youtubeApiKey" -Method Get -TimeoutSec 10
                    if ($search.items.Count -gt 0) {
                        $videoId = $search.items[0].id.videoId
                        $videos = Invoke-RestMethod -Uri "https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=$videoId&key=$youtubeApiKey" -Method Get -TimeoutSec 10
                        $details = $videos.items[0].liveStreamingDetails
                        $state.liveData["youtube_viewers"] = if ($details.concurrentViewers) { [int]$details.concurrentViewers } else { 0 }
                        $state.liveData["youtube_live"] = $true

                        if ($details.activeLiveChatId) {
                            $chatUrl = "https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=$($details.activeLiveChatId)&part=snippet,authorDetails&key=$youtubeApiKey"
                            if ($youtubeChatPageToken) { $chatUrl += "&pageToken=$youtubeChatPageToken" }
                            $chat = Invoke-RestMethod -Uri $chatUrl -Method Get -TimeoutSec 10
                            $youtubeChatPageToken = $chat.nextPageToken
                            $state.youtubeAlerts = @()
                            foreach ($item in $chat.items) {
                                $author = $item.authorDetails.displayName
                                if (-not $author) { $author = "Someone" }
                                if ($item.snippet.type -eq "superChatEvent") {
                                    $amount = $item.snippet.superChatDetails.amountDisplayString
                                    $state.youtubeAlerts += @{ kind = "cheer"; user = $author; message = "sent a Super Chat ($amount)!" }
                                } elseif ($item.snippet.type -eq "newSponsorEvent") {
                                    $state.youtubeAlerts += @{ kind = "sub"; user = $author; message = "just became a member!" }
                                }
                            }
                        }
                    } else {
                        $state.liveData["youtube_viewers"] = 0
                        $state.liveData["youtube_live"] = $false
                    }
                    $state.youtubeStatus = "connected"
                } catch {
                    $state.youtubeStatus = "error"
                    $state.youtubeError = $_.Exception.Message
                }
            }

            ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            Start-Sleep -Seconds 30
        }
    } -ArgumentList $CredentialsPath, (Join-Path $Here ".poll-state.json") | Out-Null
}

function Start-ChaturbateLoop {
    # Its own job since Chaturbate's Events API is a long-poll (the request
    # itself blocks server-side for up to ~25s) -- running it in the same
    # loop as Start-PollLoop would delay Twitch/Kick/YouTube's fixed 30s
    # cadence by that much every cycle.
    Start-Job -ScriptBlock {
        param($CredentialsPath, $StatePath)
        $nextUrl = $null
        while ($true) {
            $state = @{ chaturbateStatus = "disconnected"; chaturbateError = ""; alerts = @() }
            $creds = @{}
            if (Test-Path $CredentialsPath) {
                try {
                    $obj = Get-Content $CredentialsPath -Raw | ConvertFrom-Json
                    $obj.PSObject.Properties | ForEach-Object { $creds[$_.Name] = $_.Value }
                } catch { }
            }
            $username = $creds["chaturbateUsername"]
            $token = $creds["chaturbateToken"]
            if (-not ($username -and $token)) {
                ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                Start-Sleep -Seconds 30
                continue
            }
            try {
                $state.chaturbateStatus = "connecting"
                if (-not $nextUrl) {
                    $nextUrl = "https://eventsapi.chaturbate.com/events/$([uri]::EscapeDataString($username))/$([uri]::EscapeDataString($token))/?timeout=25"
                }
                $payload = Invoke-RestMethod -Uri $nextUrl -Method Get -TimeoutSec 30
                $nextUrl = $payload.nextUrl
                $state.chaturbateStatus = "connected"
                foreach ($event in $payload.events) {
                    if ($event.method -eq "tip") {
                        $user = $event.object.user.username
                        if (-not $user) { $user = "Someone" }
                        $state.alerts += @{ kind = "tip"; user = $user; message = "tipped $($event.object.tip.tokens) tokens!" }
                    } elseif ($event.method -eq "follow") {
                        $user = $event.object.user.username
                        if (-not $user) { $user = "Someone" }
                        $state.alerts += @{ kind = "follow"; user = $user; message = "just followed!" }
                    }
                }
                ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            } catch {
                $state.chaturbateStatus = "error"
                $state.chaturbateError = $_.Exception.Message
                $nextUrl = $null
                ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                Start-Sleep -Seconds 30
            }
        }
    } -ArgumentList $CredentialsPath, (Join-Path $Here ".chaturbate-state.json") | Out-Null
}

function Start-StreamerbotLoop {
    # Relays chat into liveData["latest_chat"] from a Streamer.bot instance
    # already running on the RECIPIENT's own machine (not something this
    # helper starts). Uses .NET's built-in System.Net.WebSockets.ClientWebSocket
    # (handles the handshake and frame/fragment reassembly for us -- no
    # hand-rolled client needed here the way helper.py's Python twin required,
    # since Python's stdlib has no WebSocket client but .NET does). The
    # connect + salt/challenge auth algorithm matches StreamerSuite's own
    # src/lib/streamerbot.ts exactly; the Subscribe request/event shape is
    # Streamer.bot's own public WebSocket API and is best-effort -- unlike
    # the connect+auth handshake, StreamerSuite's own code never subscribes
    # to receive events, only sends DoAction requests.
    Start-Job -ScriptBlock {
        param($CredentialsPath, $StatePath)
        Add-Type -AssemblyName System.Net.WebSockets -ErrorAction SilentlyContinue

        function Get-Sha256Base64($Text) {
            $sha = [System.Security.Cryptography.SHA256]::Create()
            try {
                $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
                return [Convert]::ToBase64String($bytes)
            } finally {
                $sha.Dispose()
            }
        }

        function Receive-WsMessage($Socket) {
            $buffer = New-Object byte[] 8192
            $segment = New-Object System.ArraySegment[byte] (, $buffer)
            $ms = New-Object System.IO.MemoryStream
            do {
                $result = $Socket.ReceiveAsync($segment, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
                if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { return $null }
                $ms.Write($buffer, 0, $result.Count)
            } while (-not $result.EndOfMessage)
            return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
        }

        function Send-WsMessage($Socket, $Text) {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
            $segment = New-Object System.ArraySegment[byte] (, $bytes)
            $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
        }

        while ($true) {
            $creds = @{}
            if (Test-Path $CredentialsPath) {
                try {
                    $obj = Get-Content $CredentialsPath -Raw | ConvertFrom-Json
                    $obj.PSObject.Properties | ForEach-Object { $creds[$_.Name] = $_.Value }
                } catch { }
            }
            if (-not $creds.ContainsKey("streamerbotHost")) {
                # Never touched the Streamer.bot card (no Save click yet) --
                # skip instead of connecting to the 127.0.0.1:8080 default
                # unasked, same as Twitch/Chaturbate skip without saved
                # credentials.
                $skipState = @{ streamerbotStatus = "disconnected"; streamerbotError = ""; latestChat = $null }
                ($skipState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                Start-Sleep -Seconds 10
                continue
            }
            $sbHost = $creds["streamerbotHost"]; if (-not $sbHost) { $sbHost = "127.0.0.1" }
            $sbPort = $creds["streamerbotPort"]; if (-not $sbPort) { $sbPort = "8080" }
            $sbPassword = $creds["streamerbotPassword"]

            $state = @{ streamerbotStatus = "connecting"; streamerbotError = ""; latestChat = $null }
            ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8

            $socket = New-Object System.Net.WebSockets.ClientWebSocket
            try {
                $uri = New-Object System.Uri("ws://$($sbHost):$($sbPort)/")
                $socket.ConnectAsync($uri, [System.Threading.CancellationToken]::None).Wait()

                $raw = Receive-WsMessage $socket
                if ($null -eq $raw) { throw "Streamer.bot closed the connection during handshake" }
                $msg = $raw | ConvertFrom-Json
                if ($msg.authentication -and $sbPassword) {
                    $secret = Get-Sha256Base64($sbPassword + $msg.authentication.salt)
                    $authentication = Get-Sha256Base64($secret + $msg.authentication.challenge)
                    Send-WsMessage $socket (@{ request = "Authenticate"; authentication = $authentication; id = "connect" } | ConvertTo-Json -Compress)
                    $raw = Receive-WsMessage $socket
                    if ($null -eq $raw) { throw "Streamer.bot closed the connection during authentication" }
                    $ack = $raw | ConvertFrom-Json
                    if ($ack.status -ne "ok") { throw ($ack.error, "authentication failed -- check the Streamer.bot password" | Where-Object { $_ } | Select-Object -First 1) }
                }
                # No password saved and the server didn't insist on one --
                # matches streamerbot.ts's own behavior of proceeding
                # unauthenticated in that case.

                # Streamer.bot alerts aren't a fixed platform-defined list --
                # they're whatever the STREAMER set up in their own Streamer.bot
                # instance. Subscribes to both Streamer.bot's own built-in
                # per-platform triggers (fire regardless of custom setup) and
                # "Custom" -- Streamer.bot's general-purpose mechanism for a
                # user's Action to broadcast an arbitrary named event, parsed
                # generically below rather than assuming a fixed shape.
                $subscribeBody = @{
                    request = "Subscribe"; id = "streamersuite-portable"
                    events  = @{
                        General = @("Custom")
                        Twitch  = @("ChatMessage", "Follow", "Sub", "ReSub", "GiftSub", "Cheer", "Raid")
                        YouTube = @("Message", "NewSponsor", "SuperChat")
                        Kick    = @("ChatMessage", "Follow", "Sub", "GiftedSubscriptions")
                    }
                } | ConvertTo-Json -Compress -Depth 5
                Send-WsMessage $socket $subscribeBody

                $state.streamerbotStatus = "connected"
                ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8

                $alertKindByType = @{
                    Follow = "follow"; Sub = "sub"; ReSub = "sub"; GiftSub = "sub"
                    GiftedSubscriptions = "sub"; NewSponsor = "sub"
                    Cheer = "cheer"; SuperChat = "cheer"; Raid = "raid"
                }
                $alertMessageByType = @{
                    Follow = "just followed!"; Sub = "subscribed!"; ReSub = "resubscribed!"
                    GiftSub = "gifted a sub!"; GiftedSubscriptions = "gifted subs!"
                    NewSponsor = "just became a member!"; Cheer = "sent cheer bits!"
                    SuperChat = "sent a Super Chat!"; Raid = "raided the channel!"
                }

                function Get-StreamerbotUser($Data) {
                    if ($Data.user) {
                        foreach ($key in @("display", "displayName", "name", "username")) {
                            if ($Data.user.$key) { return $Data.user.$key }
                        }
                    }
                    foreach ($key in @("displayName", "userName", "user_name", "name")) {
                        if ($Data.$key) { return $Data.$key }
                    }
                    return $null
                }

                while ($true) {
                    $raw = Receive-WsMessage $socket
                    if ($null -eq $raw) { throw "Streamer.bot connection closed" }
                    try {
                        $evt = $raw | ConvertFrom-Json
                    } catch {
                        continue
                    }
                    $src = $evt.event.source
                    $evtType = $evt.event.type
                    $data = $evt.data

                    if ($evtType -eq "ChatMessage" -or $evtType -eq "Message") {
                        $messageObj = $data.message
                        if ($messageObj -and $messageObj.message) {
                            $user = $messageObj.user.display
                            if (-not $user) { $user = $messageObj.user.name }
                            $chatState = @{
                                streamerbotStatus = "connected"; streamerbotError = ""
                                latestChat = if ($user) { "$($user): $($messageObj.message)" } else { $messageObj.message }
                                alerts = @()
                            }
                            ($chatState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                        }
                        continue
                    }

                    if ($src -eq "General" -and $evtType -eq "Custom") {
                        $name = if ($data.event) { $data.event } else { "custom" }
                        $user = Get-StreamerbotUser $data
                        if (-not $user) { $user = "Someone" }
                        $message = if ($data.message) { $data.message } else { "$name triggered" }
                        $customState = @{
                            streamerbotStatus = "connected"; streamerbotError = ""
                            alerts = @(@{ kind = $name; user = $user; message = $message })
                        }
                        ($customState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                        continue
                    }

                    if ($alertKindByType.ContainsKey($evtType) -and @("Twitch", "Kick", "YouTube") -contains $src) {
                        $user = Get-StreamerbotUser $data
                        if (-not $user) { $user = "Someone" }
                        $alertState = @{
                            streamerbotStatus = "connected"; streamerbotError = ""
                            alerts = @(@{ kind = $alertKindByType[$evtType]; user = $user; message = $alertMessageByType[$evtType] })
                        }
                        ($alertState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                    }
                }
            } catch {
                $errState = @{ streamerbotStatus = "error"; streamerbotError = $_.Exception.Message; latestChat = $null; alerts = @() }
                ($errState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            } finally {
                try { $socket.Dispose() } catch { }
            }
            Start-Sleep -Seconds 10
        }
    } -ArgumentList $CredentialsPath, (Join-Path $Here ".streamerbot-state.json") | Out-Null
}

function Start-JoystickLoop {
    # ActionCable gateway relay -- Bearer JWT as a ?token= query param (not
    # Basic auth, confirmed against Joystick's own reference client), same
    # subscribe/tip-parsing logic as useAlertsFeed.ts's Joystick effect.
    # wss:// TLS is handled natively by ClientWebSocket (unlike helper.py's
    # hand-rolled client, which needed an explicit TLS wrap added for this).
    Start-Job -ScriptBlock {
        param($CredentialsPath, $StatePath)
        Add-Type -AssemblyName System.Net.WebSockets -ErrorAction SilentlyContinue

        function Receive-WsMessage($Socket) {
            $buffer = New-Object byte[] 8192
            $segment = New-Object System.ArraySegment[byte] (, $buffer)
            $ms = New-Object System.IO.MemoryStream
            do {
                $result = $Socket.ReceiveAsync($segment, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
                if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { return $null }
                $ms.Write($buffer, 0, $result.Count)
            } while (-not $result.EndOfMessage)
            return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
        }

        function Send-WsMessage($Socket, $Text) {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
            $segment = New-Object System.ArraySegment[byte] (, $bytes)
            $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
        }

        $tipPattern = '^(.+?)\s+tipped\s+(\d+)\s+tokens?(?:\s+for\s+(.+))?$'

        while ($true) {
            $creds = @{}
            if (Test-Path $CredentialsPath) {
                try {
                    $obj = Get-Content $CredentialsPath -Raw | ConvertFrom-Json
                    $obj.PSObject.Properties | ForEach-Object { $creds[$_.Name] = $_.Value }
                } catch { }
            }
            $accessToken = $creds["joystickAccessToken"]
            if (-not $accessToken) {
                $idleState = @{ joystickStatus = "disconnected"; joystickError = ""; alerts = @() }
                ($idleState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                Start-Sleep -Seconds 10
                continue
            }

            $socket = New-Object System.Net.WebSockets.ClientWebSocket
            try {
                $socket.Options.AddSubProtocol("actioncable-v1-json")
                $uri = New-Object System.Uri("wss://joystick.tv/cable?token=$([uri]::EscapeDataString($accessToken))")
                $socket.ConnectAsync($uri, [System.Threading.CancellationToken]::None).Wait()

                Send-WsMessage $socket (@{
                    command    = "subscribe"
                    identifier = (@{ channel = "GatewayChannel" } | ConvertTo-Json -Compress)
                } | ConvertTo-Json -Compress)

                $connectingState = @{ joystickStatus = "connecting"; joystickError = ""; alerts = @() }
                ($connectingState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8

                while ($true) {
                    $raw = Receive-WsMessage $socket
                    if ($null -eq $raw) { throw "Joystick gateway closed the connection" }
                    try {
                        $msg = $raw | ConvertFrom-Json
                    } catch {
                        continue
                    }
                    if ($msg.type -eq "confirm_subscription") {
                        $okState = @{ joystickStatus = "connected"; joystickError = ""; alerts = @() }
                        ($okState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                        continue
                    }
                    if ($msg.type -eq "reject_subscription") { throw "Joystick rejected the gateway subscription" }
                    $inner = $msg.message
                    if ($inner -and $inner.event -eq "StreamEvent" -and $inner.type -eq "Tipped" -and $inner.text) {
                        $text = [regex]::Replace($inner.text, "<[^>]*>", "").Trim()
                        $m = [regex]::Match($text, $tipPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                        if ($m.Success) {
                            $note = $m.Groups[3].Value
                            $message = if ($note) { "tipped for `"$note`"" } else { "sent a tip!" }
                            $tipState = @{
                                joystickStatus = "connected"; joystickError = ""
                                alerts         = @(@{ kind = "tip"; user = $m.Groups[1].Value; message = $message; amount = $m.Groups[2].Value })
                            }
                            ($tipState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
                        }
                    }
                }
            } catch {
                $errState = @{ joystickStatus = "error"; joystickError = $_.Exception.Message; alerts = @() }
                ($errState | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            } finally {
                try { $socket.Dispose() } catch { }
            }
            Start-Sleep -Seconds 10
        }
    } -ArgumentList $CredentialsPath, (Join-Path $Here ".joystick-state.json") | Out-Null
}

function Apply-PollState {
    $statePath = Join-Path $Here ".poll-state.json"
    if (Test-Path $statePath) {
        try {
            $s = Get-Content $statePath -Raw | ConvertFrom-Json
            $Global:TwitchStatus = $s.twitchStatus
            $Global:TwitchError = $s.twitchError
            $Global:KickStatus = $s.kickStatus
            $Global:KickError = $s.kickError
            $Global:YoutubeStatus = $s.youtubeStatus
            $Global:YoutubeError = $s.youtubeError
            if ($s.liveData) {
                $s.liveData.PSObject.Properties | ForEach-Object { $Global:LiveData[$_.Name] = $_.Value }
            }
            if ($s.newFollow -and $s.newFollow.id) {
                if ($Global:LastFollowerId -and $Global:LastFollowerId -ne $s.newFollow.id) {
                    Push-Alert "twitch" @{ kind = "follow"; user = $s.newFollow.name; message = "just followed!" }
                }
                $Global:LastFollowerId = $s.newFollow.id
            }
            # This state file gets re-read on every incoming HTTP request (not
            # on a timer), but the background job only refreshes it every 30s
            # -- without this cycle check, the same youtubeAlerts batch would
            # get pushed once per request instead of once per actual poll.
            if ($s.youtubeAlerts -and $s.cycle -ne $Global:LastYoutubeCycle) {
                foreach ($a in $s.youtubeAlerts) {
                    Push-Alert "youtube" @{ kind = $a.kind; user = $a.user; message = $a.message }
                }
                $Global:LastYoutubeCycle = $s.cycle
            }
        } catch { }
    }

    $cbStatePath = Join-Path $Here ".chaturbate-state.json"
    if (Test-Path $cbStatePath) {
        try {
            $s = Get-Content $cbStatePath -Raw | ConvertFrom-Json
            $Global:ChaturbateStatus = $s.chaturbateStatus
            $Global:ChaturbateError = $s.chaturbateError
            $stamp = (Get-Item $cbStatePath).LastWriteTimeUtc.Ticks
            if ($s.alerts -and $stamp -ne $Global:LastChaturbateStamp) {
                foreach ($a in $s.alerts) {
                    Push-Alert "chaturbate" @{ kind = $a.kind; user = $a.user; message = $a.message }
                }
                $Global:LastChaturbateStamp = $stamp
            }
        } catch { }
    }

    $sbStatePath = Join-Path $Here ".streamerbot-state.json"
    if (Test-Path $sbStatePath) {
        try {
            $s = Get-Content $sbStatePath -Raw | ConvertFrom-Json
            $Global:StreamerbotStatus = $s.streamerbotStatus
            $Global:StreamerbotError = $s.streamerbotError
            if ($s.latestChat) { $Global:LiveData["latest_chat"] = $s.latestChat }
            $sbStamp = (Get-Item $sbStatePath).LastWriteTimeUtc.Ticks
            if ($s.alerts -and $sbStamp -ne $Global:LastStreamerbotStamp) {
                foreach ($a in $s.alerts) {
                    Push-Alert "streamerbot" @{ kind = $a.kind; user = $a.user; message = $a.message }
                }
                $Global:LastStreamerbotStamp = $sbStamp
            }
        } catch { }
    }

    $jtStatePath = Join-Path $Here ".joystick-state.json"
    if (Test-Path $jtStatePath) {
        try {
            $s = Get-Content $jtStatePath -Raw | ConvertFrom-Json
            $Global:JoystickStatus = $s.joystickStatus
            $Global:JoystickError = $s.joystickError
            $stamp = (Get-Item $jtStatePath).LastWriteTimeUtc.Ticks
            if ($s.alerts -and $stamp -ne $Global:LastJoystickStamp) {
                foreach ($a in $s.alerts) {
                    Push-Alert "joystick" @{ kind = $a.kind; user = $a.user; message = $a.message; amount = $a.amount }
                }
                $Global:LastJoystickStamp = $stamp
            }
        } catch { }
    }
}

function Get-OverlayListHtml {
    $items = ""
    foreach ($pair in (Get-RegisteredManifests).GetEnumerator() | Sort-Object Key) {
        $name = $pair.Value.manifest.overlayName
        if (-not $name) { $name = $pair.Key }
        $items += "<li>$name -- <code>http://127.0.0.1:$Port/custom-overlay/$($pair.Key)/overlay.html</code></li>"
    }
    if (-not $items) { $items = "<li>None registered</li>" }
    return $items
}

# One entry per platform this helper knows how to poll/relay. Which of
# these actually appear on the setup page is driven entirely by
# Get-NeededPlatforms below (the union of "platforms" declared across
# currently-registered overlays' own manifest.json files) -- an overlay
# the wizard was only told needs Twitch never shows a Kick/YouTube/
# Chaturbate/Streamer.bot card, matching helper.py's own behavior exactly.
$Script:PlatformCards = @{
    twitch = {
        param($Creds)
        $clientId = if ($Creds["twitchClientId"]) { $Creds["twitchClientId"] } else { "" }
        $token = if ($Creds["twitchToken"]) { $Creds["twitchToken"] } else { "" }
        return @"
  <div class="card">
    <h3>Twitch <span id="twitch-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Paste a Client ID + Access Token from your own Twitch application
      (not the overlay creator's). Needs the <code>moderator:read:followers</code> and
      <code>channel:read:subscriptions</code> scopes for follower/sub counts.</p>
    <label>Client ID</label>
    <input type="text" id="twitchClientId" value="$clientId">
    <label>Access Token</label>
    <input type="password" id="twitchToken" value="$token">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
    <button class="secondary" onclick="sendTestAlert()">Send Test Alert</button>
  </div>
"@
    }
    kick = {
        param($Creds)
        $slug = if ($Creds["kickSlug"]) { $Creds["kickSlug"] } else { "" }
        $token = if ($Creds["kickToken"]) { $Creds["kickToken"] } else { "" }
        $webhookUrl = if ($Creds["kickWebhookUrl"]) { $Creds["kickWebhookUrl"] } else { "" }
        return @"
  <div class="card">
    <h3>Kick <span id="kick-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Paste your own access token and channel slug (the name in your Kick URL).
      Kick's API only exposes live viewer count/status this way -- no follower/sub totals.</p>
    <label>Channel Slug</label>
    <input type="text" id="kickSlug" value="$slug">
    <label>Access Token</label>
    <input type="password" id="kickToken" value="$token">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
    <hr style="border-color:#2a2a2a;margin:16px 0">
    <p class="muted"><strong>Real-time alerts (optional, more setup)</strong> -- Kick only pushes
      follow/sub/tip events to a URL reachable from the internet, not to this helper directly
      (which only ever listens on your own machine). Run a tunnel tool (e.g. ngrok, cloudflared)
      pointing at this helper's port, paste the tunnel's public URL below, then register
      <code>&lt;your tunnel URL&gt;/kick-webhook</code> as the Webhook URL in your Kick app's
      developer settings.</p>
    <p class="muted" style="color:#facc15">&#9888; This endpoint doesn't verify Kick's webhook
      signature yet -- treat your tunnel URL as something to keep private, not something to hand out.</p>
    <label>Tunnel URL</label>
    <input type="text" id="kickWebhookUrl" placeholder="https://your-tunnel.example.com" value="$webhookUrl">
    <button onclick="saveCredentials()">Save Tunnel URL</button>
  </div>
"@
    }
    youtube = {
        param($Creds)
        $channelId = if ($Creds["youtubeChannelId"]) { $Creds["youtubeChannelId"] } else { "" }
        $apiKey = if ($Creds["youtubeApiKey"]) { $Creds["youtubeApiKey"] } else { "" }
        return @"
  <div class="card">
    <h3>YouTube <span id="youtube-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Paste your own YouTube Data API v3 key (free from Google Cloud Console -- no OAuth
      app needed) and your channel ID. Only works while you have an active live broadcast; gives
      viewer count plus Super Chat / new membership alerts. Regular chat isn't surfaced.</p>
    <label>Channel ID</label>
    <input type="text" id="youtubeChannelId" value="$channelId">
    <label>API Key</label>
    <input type="password" id="youtubeApiKey" value="$apiKey">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
  </div>
"@
    }
    chaturbate = {
        param($Creds)
        $username = if ($Creds["chaturbateUsername"]) { $Creds["chaturbateUsername"] } else { "" }
        $token = if ($Creds["chaturbateToken"]) { $Creds["chaturbateToken"] } else { "" }
        return @"
  <div class="card">
    <h3>Chaturbate <span id="chaturbate-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Paste your own username and Events API token (generate one at
      chaturbate.com/statsapi/authtoken/). Gives real tip and follow alerts.</p>
    <label>Username</label>
    <input type="text" id="chaturbateUsername" value="$username">
    <label>Events API Token</label>
    <input type="password" id="chaturbateToken" value="$token">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
  </div>
"@
    }
    streamerbot = {
        param($Creds)
        $sbHost = if ($Creds["streamerbotHost"]) { $Creds["streamerbotHost"] } else { "127.0.0.1" }
        $sbPort = if ($Creds["streamerbotPort"]) { $Creds["streamerbotPort"] } else { "8080" }
        $sbPassword = if ($Creds["streamerbotPassword"]) { $Creds["streamerbotPassword"] } else { "" }
        return @"
  <div class="card">
    <h3>Streamer.bot <span id="streamerbot-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Streamer.bot must already be running on this machine with its WebSocket Server
      enabled. Gives the latest chat message (any platform Streamer.bot itself is connected to,
      including YouTube). Leave Host/Port at their defaults unless you changed them in Streamer.bot.</p>
    <label>Host</label>
    <input type="text" id="streamerbotHost" value="$sbHost">
    <label>Port</label>
    <input type="text" id="streamerbotPort" value="$sbPort">
    <label>Password (only if you set one in Streamer.bot)</label>
    <input type="password" id="streamerbotPassword" value="$sbPassword">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
  </div>
"@
    }
    joystick = {
        param($Creds)
        $clientId = if ($Creds["joystickClientId"]) { $Creds["joystickClientId"] } else { "" }
        $username = $Creds["joystickUsername"]
        $connectedLine = if ($username) { "<p class=`"muted`">Connected as $username</p>" } else { "" }
        $redirectUri = Get-JoystickRedirectUri $Port
        return @"
  <div class="card">
    <h3>Joystick.tv <span id="joystick-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Register your own OAuth app at your Joystick.tv bot settings, using this exact
      Redirect URI: <code>$redirectUri</code> -- then paste its Client ID below and click Connect.
      Gives real tip alerts.</p>
    <label>Client ID</label>
    <input type="text" id="joystickClientId" value="$clientId">
    <button onclick="saveCredentials()">Save</button>
    <button class="secondary" onclick="window.location='/joystick-connect'">Connect via Joystick.tv</button>
    $connectedLine
  </div>
"@
    }
}

$Script:PlatformCredentialFields = @{
    twitch      = @('twitchClientId: document.getElementById("twitchClientId").value', 'twitchToken: document.getElementById("twitchToken").value')
    kick        = @('kickSlug: document.getElementById("kickSlug").value', 'kickToken: document.getElementById("kickToken").value', 'kickWebhookUrl: document.getElementById("kickWebhookUrl").value')
    youtube     = @('youtubeChannelId: document.getElementById("youtubeChannelId").value', 'youtubeApiKey: document.getElementById("youtubeApiKey").value')
    chaturbate  = @('chaturbateUsername: document.getElementById("chaturbateUsername").value', 'chaturbateToken: document.getElementById("chaturbateToken").value')
    streamerbot = @('streamerbotHost: document.getElementById("streamerbotHost").value', 'streamerbotPort: document.getElementById("streamerbotPort").value', 'streamerbotPassword: document.getElementById("streamerbotPassword").value')
    joystick    = @('joystickClientId: document.getElementById("joystickClientId").value')
}

$Script:PlatformStatusIds = @{
    twitch      = @("twitch-status", "twitchStatus")
    kick        = @("kick-status", "kickStatus")
    youtube     = @("youtube-status", "youtubeStatus")
    chaturbate  = @("chaturbate-status", "chaturbateStatus")
    streamerbot = @("streamerbot-status", "streamerbotStatus")
    joystick    = @("joystick-status", "joystickStatus")
}

function Get-NeededPlatforms {
    $needed = New-Object System.Collections.Generic.HashSet[string]
    foreach ($entry in (Get-RegisteredManifests).Values) {
        foreach ($p in $entry.manifest.platforms) { $needed.Add($p) | Out-Null }
    }
    return $needed
}

function Get-SetupPageHtml {
    $creds = Load-Credentials
    $overlayListHtml = Get-OverlayListHtml
    $needed = Get-NeededPlatforms
    $platformOrder = @("twitch", "kick", "youtube", "chaturbate", "streamerbot", "joystick") | Where-Object { $needed.Contains($_) }

    if ($platformOrder.Count -eq 0) {
        $cardsHtml = '<div class="card"><p class="muted">This overlay doesn''t use any live platform data -- nothing to connect.</p></div>'
        $credentialFields = ""
        $statusRefresh = ""
    } else {
        $cardsHtml = ($platformOrder | ForEach-Object { & $Script:PlatformCards[$_] $creds }) -join "`n"
        $credentialFields = (($platformOrder | ForEach-Object { $Script:PlatformCredentialFields[$_] } | ForEach-Object { "      $_" }) -join ",`n")
        $statusRefresh = (($platformOrder | ForEach-Object {
            $ids = $Script:PlatformStatusIds[$_]
            "    setStatus(`"$($ids[0])`", s.$($ids[1]));"
        }) -join "`n")
    }

    return @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>StreamerSuite Overlay Helper</title>
<style>
  body { font-family: -apple-system, "Segoe UI", sans-serif; background: #0a0a0a; color: #eee; margin: 0; padding: 32px; }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 20px; }
  .card { background: #151515; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  label { display: block; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: .04em; margin: 10px 0 4px; }
  input[type=text], input[type=password], input[type=number] { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #333; background: #0a0a0a; color: #eee; }
  input[type=color] { width: 60px; height: 32px; border: none; background: none; }
  button { background: #9146ff; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; margin-top: 12px; }
  button.secondary { background: #2a2a2a; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .status.connected { background: #16321f; color: #4ade80; }
  .status.disconnected { background: #321616; color: #f87171; }
  .status.connecting, .status.error { background: #322616; color: #facc15; }
  .muted { color: #888; font-size: 13px; }
  code { background: #0a0a0a; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
  ul { padding-left: 18px; margin: 6px 0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>StreamerSuite Overlay Helper</h1>
  <p class="muted">One helper, every overlay you've been given -- credentials below are shared across all of them.</p>

  <div class="card">
    <h3>Your overlays</h3>
    <ul>$overlayListHtml</ul>
  </div>

$cardsHtml

  <div class="card">
    <h3>Advanced</h3>
    <label>Port (requires restarting the helper to change)</label>
    <input type="number" id="port" value="$Port" disabled>
  </div>
</div>
<script>
function saveCredentials() {
  fetch("/save-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
$credentialFields
    }),
  }).then(refreshStatus);
}
function sendTestAlert() {
  fetch("/test-alert", { method: "POST" });
}
function setStatus(id, value) {
  var el = document.getElementById(id);
  el.textContent = value;
  el.className = "status " + value;
}
function refreshStatus() {
  fetch("/status").then(function(r) { return r.json(); }).then(function(s) {
$statusRefresh
  }).catch(function() {});
}
refreshStatus();
setInterval(refreshStatus, 4000);
</script>
</body>
</html>
"@
}

function Send-JsonResponse($Response, $Object, $StatusCode = 200) {
    $json = $Object | ConvertTo-Json -Depth 6 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Send-HtmlResponse($Response, $Html, $StatusCode = 200) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Html)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "text/html; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

if (Try-JoinExistingHelper) {
    return
}

# Becoming the shared helper: claim the registry pointer, and pick back up
# any overlay folders registered by a previous run of this same process (so
# a restart doesn't lose overlays registered earlier -- a folder that's
# since been moved/deleted just quietly drops out when
# Get-RegisteredManifests can't read its manifest.json anymore).
(@{ port = $Port } | ConvertTo-Json) | Set-Content -Path $RegistryPath -Encoding UTF8
if (Test-Path $RegisteredDirsPath) {
    try {
        $previous = Get-Content $RegisteredDirsPath -Raw | ConvertFrom-Json
        foreach ($d in @($previous)) {
            if ($d -and -not ($Global:RegisteredDirs -contains $d)) { $Global:RegisteredDirs.Add($d) | Out-Null }
        }
    } catch { }
}
Persist-RegisteredDirs

Start-PollLoop
Start-ChaturbateLoop
Start-StreamerbotLoop
Start-JoystickLoop

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://127.0.0.1:$Port/")
$Listener.Start()
Write-Host "StreamerSuite standalone overlay helper running at http://127.0.0.1:$Port/setup"
Write-Host "Open that URL to connect your accounts. Leave this window open while streaming."

try {
    while ($Listener.IsListening) {
        $context = $Listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        Apply-PollState

        switch ($true) {
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/ping" } {
                Send-JsonResponse $response @{ ok = $true }
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/poll-data" } {
                Send-JsonResponse $response $Global:LiveData
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath.StartsWith("/poll-alerts/") } {
                $overlayId = $request.Url.AbsolutePath.Substring("/poll-alerts/".Length).Split("/")[0]
                $events = if ($Global:AlertQueues.ContainsKey($overlayId)) { @($Global:AlertQueues[$overlayId]) } else { @() }
                if ($Global:AlertQueues.ContainsKey($overlayId)) { $Global:AlertQueues[$overlayId].Clear() }
                Send-JsonResponse $response $events
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/status" } {
                Send-JsonResponse $response @{
                    twitchStatus = $Global:TwitchStatus; twitchError = $Global:TwitchError
                    kickStatus = $Global:KickStatus; kickError = $Global:KickError
                    youtubeStatus = $Global:YoutubeStatus; youtubeError = $Global:YoutubeError
                    chaturbateStatus = $Global:ChaturbateStatus; chaturbateError = $Global:ChaturbateError
                    streamerbotStatus = $Global:StreamerbotStatus; streamerbotError = $Global:StreamerbotError
                    joystickStatus = $Global:JoystickStatus; joystickError = $Global:JoystickError
                }
                break
            }
            { $request.HttpMethod -eq "GET" -and ($request.Url.AbsolutePath -eq "/setup" -or $request.Url.AbsolutePath -eq "/") } {
                Send-HtmlResponse $response (Get-SetupPageHtml)
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/joystick-connect" } {
                $creds = Load-Credentials
                $clientId = $creds["joystickClientId"]
                if (-not $clientId) {
                    Send-HtmlResponse $response "<h1>Save a Joystick.tv Client ID first, then try Connect again.</h1>" 400
                    break
                }
                $stateBytes = New-Object byte[] 18
                [System.Security.Cryptography.RandomNumberGenerator]::Fill($stateBytes)
                $Global:JoystickOAuthState = ConvertTo-Base64Url $stateBytes
                $Global:JoystickOAuthVerifier = Get-JoystickCodeVerifier
                $redirectUri = Get-JoystickRedirectUri $Port
                $challenge = Get-JoystickCodeChallenge $Global:JoystickOAuthVerifier
                $authorizeUrl = "https://joystick.tv/oauth/authorize?" +
                    "response_type=code" +
                    "&client_id=$([uri]::EscapeDataString($clientId))" +
                    "&redirect_uri=$([uri]::EscapeDataString($redirectUri))" +
                    "&scope=$([uri]::EscapeDataString('identity:read chat:read chat:write chat:moderate'))" +
                    "&state=$($Global:JoystickOAuthState)" +
                    "&code_challenge=$challenge" +
                    "&code_challenge_method=S256"
                $response.StatusCode = 302
                $response.AddHeader("Location", $authorizeUrl)
                $response.OutputStream.Close()
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/joystick-oauth-callback" } {
                $queryParams = @{}
                $rawQuery = $request.Url.Query.TrimStart("?")
                if ($rawQuery) {
                    foreach ($pair in $rawQuery.Split("&")) {
                        $kv = $pair.Split("=", 2)
                        if ($kv.Length -eq 2) { $queryParams[$kv[0]] = [uri]::UnescapeDataString($kv[1]) }
                    }
                }
                $code = $queryParams["code"]
                $state = $queryParams["state"]
                if (-not $code -or -not $state -or $state -ne $Global:JoystickOAuthState) {
                    Send-HtmlResponse $response "<h1>Joystick login didn't complete (missing/mismatched state) -- try Connect again.</h1>" 400
                    break
                }
                try {
                    $creds = Load-Credentials
                    $clientId = $creds["joystickClientId"]
                    $redirectUri = Get-JoystickRedirectUri $Port
                    $tokenBody = @{
                        grant_type    = "authorization_code"
                        code          = $code
                        redirect_uri  = $redirectUri
                        client_id     = $clientId
                        code_verifier = $Global:JoystickOAuthVerifier
                    }
                    $tokenResp = Invoke-RestMethod -Uri "https://joystick.tv/api/oauth/token" -Method Post -Body $tokenBody -TimeoutSec 10
                    if (-not $tokenResp.access_token) { throw "Joystick didn't return an access token -- check the Client ID" }
                    $identityHeaders = @{ "Authorization" = "Bearer $($tokenResp.access_token)"; "Accept" = "application/json" }
                    $username = "connected"
                    try {
                        $identity = Invoke-RestMethod -Uri "https://joystick.tv/api/v1/me/identity" -Headers $identityHeaders -Method Get -TimeoutSec 10
                        foreach ($key in @("username", "slug", "display_name", "name")) {
                            if ($identity.$key) { $username = $identity.$key; break }
                        }
                    } catch { }
                    Save-Credentials @{
                        joystickAccessToken  = $tokenResp.access_token
                        joystickRefreshToken = $tokenResp.refresh_token
                        joystickUsername     = $username
                    }
                    $Global:JoystickOAuthState = $null
                    $Global:JoystickOAuthVerifier = $null
                    $response.StatusCode = 302
                    $response.AddHeader("Location", "/setup")
                    $response.OutputStream.Close()
                } catch {
                    Send-HtmlResponse $response "<h1>Joystick login failed: $($_.Exception.Message)</h1>" 500
                }
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath.StartsWith("/custom-overlay/") } {
                $overlayId = $request.Url.AbsolutePath.Substring("/custom-overlay/".Length).Split("/")[0]
                $registered = Get-RegisteredManifests
                if ($registered.ContainsKey($overlayId)) {
                    $overlayPath = Join-Path $registered[$overlayId].dir "overlay.html"
                    if (Test-Path $overlayPath) {
                        Send-HtmlResponse $response (Get-Content $overlayPath -Raw)
                    } else {
                        Send-HtmlResponse $response "<h1>overlay.html not found</h1>" 404
                    }
                } else {
                    Send-HtmlResponse $response "<h1>overlay not found (not registered with this helper)</h1>" 404
                }
                break
            }
            { $request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/register" } {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                if ($body.dir -and (Load-ManifestFor $body.dir)) {
                    if (-not ($Global:RegisteredDirs -contains $body.dir)) { $Global:RegisteredDirs.Add($body.dir) | Out-Null }
                    Persist-RegisteredDirs
                    Send-JsonResponse $response @{ ok = $true }
                } else {
                    Send-JsonResponse $response @{ ok = $false; error = "no manifest.json at that folder" } 400
                }
                break
            }
            { $request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/save-credentials" } {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                $creds = @{}
                if ($body.twitchClientId) { $creds["twitchClientId"] = $body.twitchClientId }
                if ($body.twitchToken) { $creds["twitchToken"] = $body.twitchToken }
                if ($body.kickSlug) { $creds["kickSlug"] = $body.kickSlug }
                if ($body.kickToken) { $creds["kickToken"] = $body.kickToken }
                if ($body.kickWebhookUrl) { $creds["kickWebhookUrl"] = $body.kickWebhookUrl }
                if ($body.youtubeChannelId) { $creds["youtubeChannelId"] = $body.youtubeChannelId }
                if ($body.youtubeApiKey) { $creds["youtubeApiKey"] = $body.youtubeApiKey }
                if ($body.chaturbateUsername) { $creds["chaturbateUsername"] = $body.chaturbateUsername }
                if ($body.chaturbateToken) { $creds["chaturbateToken"] = $body.chaturbateToken }
                if ($body.streamerbotHost) { $creds["streamerbotHost"] = $body.streamerbotHost }
                if ($body.streamerbotPort) { $creds["streamerbotPort"] = $body.streamerbotPort }
                if ($body.streamerbotPassword) { $creds["streamerbotPassword"] = $body.streamerbotPassword }
                Save-Credentials $creds
                Send-JsonResponse $response @{ ok = $true }
                break
            }
            { $request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/test-alert" } {
                # Fired from the Twitch card specifically, so it only
                # reaches overlays that actually declare "twitch" -- same
                # scoping rule as every real alert.
                Push-Alert "twitch" @{ kind = "follow"; user = "TestViewer"; message = "just followed! (test)" }
                Send-JsonResponse $response @{ ok = $true }
                break
            }
            { $request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/kick-webhook" } {
                # NOT SIGNATURE-VERIFIED. Kick signs webhook deliveries (per
                # docs.kick.com/events/webhook-security), but that
                # verification isn't implemented here yet -- this was built
                # without being able to reach docs.kick.com to confirm the
                # exact header names/algorithm/public-key format, and
                # guessing at crypto verification is worse than clearly not
                # doing it. Anyone who learns the recipient's tunnel URL can
                # currently POST a fake event here. Revisit once those docs
                # are reachable.
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $bodyText = $reader.ReadToEnd()
                $kickBody = try { $bodyText | ConvertFrom-Json } catch { $null }
                $eventType = $request.Headers["Kick-Event-Type"]
                if (-not $eventType -and $kickBody) { $eventType = $kickBody.type }
                if (-not $eventType -and $kickBody) { $eventType = $kickBody.event }
                $alert = Get-KickWebhookAlert $eventType $kickBody
                if ($alert) { Push-Alert "kick" $alert }
                Send-JsonResponse $response @{ ok = $true }
                break
            }
            default {
                Send-HtmlResponse $response "<h1>Not found</h1>" 404
            }
        }
    }
} finally {
    $Listener.Stop()
}
