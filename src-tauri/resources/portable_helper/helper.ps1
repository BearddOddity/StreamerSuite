# StreamerSuite standalone overlay helper (Windows).
#
# Runs entirely on PowerShell + .NET, both already part of Windows -- no
# separate install needed. Serves this folder's overlay.html (and any other
# overlay folder that registers with it -- see "Shared helper" below), hosts
# a local setup page to connect your own Twitch/Kick accounts, and polls
# those platforms on your behalf so bound fields/alerts stay live.
#
# Shared helper: if you've been given more than one StreamerSuite overlay,
# you only ever need ONE of these running at a time. When a second (or
# third...) overlay's helper.ps1 is launched, it notices one is already
# running, hands its own folder over to it, and exits -- the already-running
# one then serves every overlay you've registered, at its own URL, off the
# same port, sharing one set of connected credentials. The registry pointer
# lives at %USERPROFILE%\.streamersuite_portable_helper.json.
#
# Kick only exposes live viewer count/status through its public API -- no
# follower/sub counts or a way to detect a fresh follow, so Kick alerts
# aren't implemented (see the setup page for status).
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
$Global:AlertQueue = New-Object System.Collections.ArrayList
$Global:TwitchStatus = "disconnected"
$Global:TwitchError = ""
$Global:KickStatus = "disconnected"
$Global:KickError = ""
$Global:LastFollowerId = $null
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
        while ($true) {
            $state = @{
                twitchStatus = "disconnected"; twitchError = ""
                kickStatus = "disconnected"; kickError = ""
                liveData = @{}; newFollow = $null
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

            ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            Start-Sleep -Seconds 30
        }
    } -ArgumentList $CredentialsPath, (Join-Path $Here ".poll-state.json") | Out-Null
}

function Apply-PollState {
    $statePath = Join-Path $Here ".poll-state.json"
    if (-not (Test-Path $statePath)) { return }
    try {
        $s = Get-Content $statePath -Raw | ConvertFrom-Json
        $Global:TwitchStatus = $s.twitchStatus
        $Global:TwitchError = $s.twitchError
        $Global:KickStatus = $s.kickStatus
        $Global:KickError = $s.kickError
        if ($s.liveData) {
            $s.liveData.PSObject.Properties | ForEach-Object { $Global:LiveData[$_.Name] = $_.Value }
        }
        if ($s.newFollow -and $s.newFollow.id) {
            if ($Global:LastFollowerId -and $Global:LastFollowerId -ne $s.newFollow.id) {
                $Global:AlertQueue.Add(@{ kind = "follow"; user = $s.newFollow.name; message = "just followed!" }) | Out-Null
            }
            $Global:LastFollowerId = $s.newFollow.id
        }
    } catch { }
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

function Get-SetupPageHtml {
    $creds = Load-Credentials
    $twitchClientId = if ($creds["twitchClientId"]) { $creds["twitchClientId"] } else { "" }
    $twitchToken = if ($creds["twitchToken"]) { $creds["twitchToken"] } else { "" }
    $kickSlug = if ($creds["kickSlug"]) { $creds["kickSlug"] } else { "" }
    $kickToken = if ($creds["kickToken"]) { $creds["kickToken"] } else { "" }
    $overlayListHtml = Get-OverlayListHtml
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

  <div class="card">
    <h3>Twitch <span id="twitch-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Paste a Client ID + Access Token from your own Twitch application
      (not the overlay creator's). Needs the <code>moderator:read:followers</code> and
      <code>channel:read:subscriptions</code> scopes for follower/sub counts.</p>
    <label>Client ID</label>
    <input type="text" id="twitchClientId" value="$twitchClientId">
    <label>Access Token</label>
    <input type="password" id="twitchToken" value="$twitchToken">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
    <button class="secondary" onclick="sendTestAlert()">Send Test Alert</button>
  </div>

  <div class="card">
    <h3>Kick <span id="kick-status" class="status disconnected">checking...</span></h3>
    <p class="muted">Paste your own access token and channel slug (the name in your Kick URL).
      Kick's API only exposes live viewer count/status this way -- no follower/sub totals,
      and no live "follow" alerts.</p>
    <label>Channel Slug</label>
    <input type="text" id="kickSlug" value="$kickSlug">
    <label>Access Token</label>
    <input type="password" id="kickToken" value="$kickToken">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
  </div>

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
      twitchClientId: document.getElementById("twitchClientId").value,
      twitchToken: document.getElementById("twitchToken").value,
      kickSlug: document.getElementById("kickSlug").value,
      kickToken: document.getElementById("kickToken").value,
    }),
  }).then(refreshStatus);
}
function sendTestAlert() {
  fetch("/test-alert", { method: "POST" });
}
function refreshStatus() {
  fetch("/status").then(function(r) { return r.json(); }).then(function(s) {
    var t = document.getElementById("twitch-status");
    t.textContent = s.twitchStatus;
    t.className = "status " + s.twitchStatus;
    var k = document.getElementById("kick-status");
    k.textContent = s.kickStatus;
    k.className = "status " + s.kickStatus;
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
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/poll-alerts" } {
                $events = @($Global:AlertQueue)
                $Global:AlertQueue.Clear()
                Send-JsonResponse $response $events
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/status" } {
                Send-JsonResponse $response @{
                    twitchStatus = $Global:TwitchStatus; twitchError = $Global:TwitchError
                    kickStatus = $Global:KickStatus; kickError = $Global:KickError
                }
                break
            }
            { $request.HttpMethod -eq "GET" -and ($request.Url.AbsolutePath -eq "/setup" -or $request.Url.AbsolutePath -eq "/") } {
                Send-HtmlResponse $response (Get-SetupPageHtml)
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
                Save-Credentials $creds
                Send-JsonResponse $response @{ ok = $true }
                break
            }
            { $request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/test-alert" } {
                $Global:AlertQueue.Add(@{ kind = "follow"; user = "TestViewer"; message = "just followed! (test)" }) | Out-Null
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
