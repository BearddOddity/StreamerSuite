# StreamerSuite standalone overlay helper (Windows).
#
# Runs entirely on PowerShell + .NET, both already part of Windows -- no
# separate install needed. Serves this folder's overlay.html at the URL
# path getOverlayToken() already expects, hosts a local setup page to
# connect your own Twitch account, and polls Twitch on your behalf so the
# overlay's bound fields/alerts stay live.
#
# Kick support isn't implemented yet (see the setup page for status) --
# Twitch is the only platform this currently fetches real data for.
#
# This is provided as-is by whoever gave you this overlay; troubleshooting
# isn't guaranteed. See README.txt for setup steps.

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $Here "manifest.json"
$CredentialsPath = Join-Path $Here "credentials.json"
$OverlayPath = Join-Path $Here "overlay.html"

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Port = [int]$Manifest.port
if (-not $Port) { $Port = 8420 }

$Global:LiveData = @{}
$Global:AlertQueue = New-Object System.Collections.ArrayList
$Global:TwitchStatus = "disconnected"
$Global:TwitchError = ""
$Global:LastFollowerId = $null
$StateLock = New-Object object

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

function Invoke-TwitchApi($Path, $Token, $ClientId, $Params) {
    $query = ""
    if ($Params) {
        $pairs = $Params.Keys | ForEach-Object { "$_=$([uri]::EscapeDataString([string]$Params[$_]))" }
        $query = "?" + ($pairs -join "&")
    }
    $headers = @{ "Authorization" = "Bearer $Token"; "Client-Id" = $ClientId }
    return Invoke-RestMethod -Uri "https://api.twitch.tv/helix$Path$query" -Headers $headers -Method Get -TimeoutSec 10
}

function Start-TwitchPollLoop {
    $job = {
        param($CredentialsPath)
        while ($true) {
            Start-Sleep -Seconds 30
        }
    }
    # Runs on a background runspace so it never blocks the HTTP listener
    # below -- polls every ~30s using whatever credentials.json currently
    # holds. A missing/invalid token just leaves status as
    # disconnected/error; the overlay keeps rendering either way, its
    # bound fields just show nothing until this succeeds.
    Start-Job -ScriptBlock {
        param($CredentialsPath, $StatePath)
        while ($true) {
            try {
                $creds = @{}
                if (Test-Path $CredentialsPath) {
                    $obj = Get-Content $CredentialsPath -Raw | ConvertFrom-Json
                    $obj.PSObject.Properties | ForEach-Object { $creds[$_.Name] = $_.Value }
                }
                $token = $creds["twitchToken"]
                $clientId = $creds["twitchClientId"]
                $state = @{ twitchStatus = "disconnected"; twitchError = ""; liveData = @{}; newFollow = $null }
                if ($token -and $clientId) {
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
                }
                ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            } catch {
                $err = @{ twitchStatus = "error"; twitchError = $_.Exception.Message; liveData = @{}; newFollow = $null }
                ($err | ConvertTo-Json -Depth 5) | Set-Content -Path $StatePath -Encoding UTF8
            }
            Start-Sleep -Seconds 30
        }
    } -ArgumentList $CredentialsPath, (Join-Path $Here ".twitch-state.json") | Out-Null
}

function Apply-TwitchState {
    $statePath = Join-Path $Here ".twitch-state.json"
    if (-not (Test-Path $statePath)) { return }
    try {
        $s = Get-Content $statePath -Raw | ConvertFrom-Json
        $Global:TwitchStatus = $s.twitchStatus
        $Global:TwitchError = $s.twitchError
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

function Get-CustomizationCardHtml {
    $c = $Manifest.customizable
    if (-not $c -or (-not $c.color -and -not $c.font)) { return "" }
    $fields = ""
    if ($c.color) { $fields += '<label>Accent Color</label><input type="color" id="accentColor" value="#9146ff">' }
    if ($c.font) { $fields += '<label>Font</label><input type="text" id="fontFamily" placeholder="e.g. Poppins (Google Fonts name)">' }
    return "<div class=`"card`"><h3>Customize</h3>$fields<button onclick=`"alert('Customization saving isn\'t wired up in this version yet.')`">Save</button></div>"
}

function Get-SetupPageHtml {
    $creds = Load-Credentials
    $twitchClientId = if ($creds["twitchClientId"]) { $creds["twitchClientId"] } else { "" }
    $twitchToken = if ($creds["twitchToken"]) { $creds["twitchToken"] } else { "" }
    return @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>$($Manifest.overlayName) -- Setup</title>
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
  code { background: #0a0a0a; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>$($Manifest.overlayName)</h1>
  <p class="muted">Overlay Browser Source URL: <code>http://127.0.0.1:$Port/custom-overlay/standalone/overlay.html</code></p>

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
    <h3>Kick</h3>
    <p class="muted">Not implemented in this version of the helper yet -- the overlay
      will still render, Kick-bound values just won't update live.</p>
  </div>

  $(Get-CustomizationCardHtml)

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
    }),
  }).then(refreshStatus);
}
function sendTestAlert() {
  fetch("/test-alert", { method: "POST" });
}
function refreshStatus() {
  fetch("/status").then(function(r) { return r.json(); }).then(function(s) {
    var el = document.getElementById("twitch-status");
    el.textContent = s.twitchStatus;
    el.className = "status " + s.twitchStatus;
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

Start-TwitchPollLoop

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
        Apply-TwitchState

        switch ($true) {
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
                Send-JsonResponse $response @{ twitchStatus = $Global:TwitchStatus; twitchError = $Global:TwitchError }
                break
            }
            { $request.HttpMethod -eq "GET" -and ($request.Url.AbsolutePath -eq "/setup" -or $request.Url.AbsolutePath -eq "/") } {
                Send-HtmlResponse $response (Get-SetupPageHtml)
                break
            }
            { $request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/custom-overlay/standalone/overlay.html" } {
                if (Test-Path $OverlayPath) {
                    Send-HtmlResponse $response (Get-Content $OverlayPath -Raw)
                } else {
                    Send-HtmlResponse $response "<h1>overlay.html not found</h1>" 404
                }
                break
            }
            { $request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/save-credentials" } {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                $creds = @{}
                if ($body.twitchClientId) { $creds["twitchClientId"] = $body.twitchClientId }
                if ($body.twitchToken) { $creds["twitchToken"] = $body.twitchToken }
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
