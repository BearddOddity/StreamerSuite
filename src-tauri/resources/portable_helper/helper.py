#!/usr/bin/env python3
"""StreamerSuite standalone overlay helper (Mac/Linux).

Runs entirely from the Python standard library (no `pip install` needed) —
serves this folder's overlay.html at the URL path getOverlayToken() already
expects, hosts a local setup page to connect your own Twitch account, and
polls Twitch on your behalf so the overlay's bound fields/alerts stay live.

Kick support isn't implemented yet (see the setup page for status) —
Twitch is the only platform this currently fetches real data for.

This is provided as-is by whoever gave you this overlay; troubleshooting
isn't guaranteed. See README.txt for setup steps.
"""
import json
import os
import threading
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(HERE, "manifest.json")
CREDENTIALS_PATH = os.path.join(HERE, "credentials.json")
OVERLAY_PATH = os.path.join(HERE, "overlay.html")

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    MANIFEST = json.load(f)

STATE_LOCK = threading.Lock()
STATE = {
    "live_data": {},
    "alert_queue": [],
    "twitch_status": "disconnected",  # disconnected | connecting | connected | error
    "twitch_error": "",
    "last_follower_id": None,
}


def load_credentials():
    if not os.path.exists(CREDENTIALS_PATH):
        return {}
    try:
        with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def save_credentials(creds):
    with open(CREDENTIALS_PATH, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2)


def twitch_get(path, token, client_id, params=None):
    url = "https://api.twitch.tv/helix" + path
    if params:
        query = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items())
        url = f"{url}?{query}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Client-Id": client_id,
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def twitch_poll_loop():
    """Runs forever in the background, refreshing STATE from Twitch every
    ~30s using whatever credentials.json currently holds. A missing/invalid
    token just leaves twitch_status as "disconnected"/"error" — the overlay
    keeps rendering, its bound fields just show nothing until this succeeds."""
    while True:
        creds = load_credentials()
        token = creds.get("twitchToken", "").strip()
        client_id = creds.get("twitchClientId", "").strip()
        if not token or not client_id:
            with STATE_LOCK:
                STATE["twitch_status"] = "disconnected"
            time.sleep(10)
            continue
        try:
            with STATE_LOCK:
                STATE["twitch_status"] = "connecting"
            users = twitch_get("/users", token, client_id)
            user = (users.get("data") or [{}])[0]
            broadcaster_id = user.get("id")
            if not broadcaster_id:
                raise ValueError("token didn't resolve to a Twitch user")

            data = {}
            streams = twitch_get("/streams", token, client_id, {"user_id": broadcaster_id})
            stream_list = streams.get("data") or []
            data["viewers"] = stream_list[0]["viewer_count"] if stream_list else 0

            try:
                followers = twitch_get(
                    "/channels/followers", token, client_id,
                    {"broadcaster_id": broadcaster_id, "first": 1},
                )
                data["followers"] = followers.get("total", 0)
                latest = (followers.get("data") or [{}])[0]
                latest_id = latest.get("user_id")
                with STATE_LOCK:
                    if latest_id and STATE["last_follower_id"] not in (None, latest_id):
                        STATE["alert_queue"].append({
                            "kind": "follow",
                            "user": latest.get("user_name", "Someone"),
                            "message": "just followed!",
                        })
                    STATE["last_follower_id"] = latest_id or STATE["last_follower_id"]
            except urllib.error.HTTPError:
                # Needs moderator:read:followers on the token — leave
                # followers unset rather than guessing at a number.
                pass

            try:
                subs = twitch_get("/subscriptions", token, client_id, {"broadcaster_id": broadcaster_id})
                data["subscribers"] = subs.get("total", 0)
            except urllib.error.HTTPError:
                # Needs channel:read:subscriptions — same reasoning as above.
                pass

            with STATE_LOCK:
                STATE["live_data"].update(data)
                STATE["twitch_status"] = "connected"
                STATE["twitch_error"] = ""
        except Exception as e:  # noqa: BLE001 - this loop must never die
            with STATE_LOCK:
                STATE["twitch_status"] = "error"
                STATE["twitch_error"] = str(e)
        time.sleep(30)


SETUP_PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{overlay_name} — Setup</title>
<style>
  body {{ font-family: -apple-system, "Segoe UI", sans-serif; background: #0a0a0a; color: #eee; margin: 0; padding: 32px; }}
  .wrap {{ max-width: 560px; margin: 0 auto; }}
  h1 {{ font-size: 20px; }}
  .card {{ background: #151515; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }}
  label {{ display: block; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: .04em; margin: 10px 0 4px; }}
  input[type=text], input[type=password], input[type=number] {{ width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #333; background: #0a0a0a; color: #eee; }}
  input[type=color] {{ width: 60px; height: 32px; border: none; background: none; }}
  button {{ background: #9146ff; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; margin-top: 12px; }}
  button.secondary {{ background: #2a2a2a; }}
  .status {{ display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }}
  .status.connected {{ background: #16321f; color: #4ade80; }}
  .status.disconnected {{ background: #321616; color: #f87171; }}
  .status.connecting, .status.error {{ background: #322616; color: #facc15; }}
  .muted {{ color: #888; font-size: 13px; }}
  code {{ background: #0a0a0a; padding: 2px 6px; border-radius: 4px; }}
  a {{ color: #a970ff; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>{overlay_name}</h1>
  <p class="muted">Overlay Browser Source URL: <code>http://127.0.0.1:{port}/custom-overlay/standalone/overlay.html</code></p>

  <div class="card">
    <h3>Twitch <span id="twitch-status" class="status disconnected">checking…</span></h3>
    <p class="muted">Paste a Client ID + Access Token from your own Twitch application
      (not the overlay creator's). Needs the <code>moderator:read:followers</code> and
      <code>channel:read:subscriptions</code> scopes for follower/sub counts.</p>
    <label>Client ID</label>
    <input type="text" id="twitchClientId" value="{twitch_client_id}">
    <label>Access Token</label>
    <input type="password" id="twitchToken" value="{twitch_token}">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
    <button class="secondary" onclick="sendTestAlert()">Send Test Alert</button>
  </div>

  <div class="card">
    <h3>Kick</h3>
    <p class="muted">Not implemented in this version of the helper yet — the overlay
      will still render, Kick-bound values just won't update live.</p>
  </div>

  {customization_card}

  <div class="card">
    <h3>Advanced</h3>
    <label>Port (requires restarting the helper to change)</label>
    <input type="number" id="port" value="{port}" disabled>
  </div>
</div>
<script>
function saveCredentials() {{
  fetch("/save-credentials", {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify({{
      twitchClientId: document.getElementById("twitchClientId").value,
      twitchToken: document.getElementById("twitchToken").value,
    }}),
  }}).then(refreshStatus);
}}
function sendTestAlert() {{
  fetch("/test-alert", {{ method: "POST" }});
}}
function refreshStatus() {{
  fetch("/status").then(function(r) {{ return r.json(); }}).then(function(s) {{
    var el = document.getElementById("twitch-status");
    el.textContent = s.twitchStatus;
    el.className = "status " + s.twitchStatus;
  }}).catch(function() {{}});
}}
refreshStatus();
setInterval(refreshStatus, 4000);
</script>
</body>
</html>
"""


def customization_card_html():
    c = MANIFEST.get("customizable", {})
    if not (c.get("color") or c.get("font")):
        return ""
    fields = []
    if c.get("color"):
        fields.append('<label>Accent Color</label><input type="color" id="accentColor" value="#9146ff">')
    if c.get("font"):
        fields.append(
            '<label>Font</label><input type="text" id="fontFamily" placeholder="e.g. Poppins (Google Fonts name)">'
        )
    return f'<div class="card"><h3>Customize</h3>{"".join(fields)}' \
           f'<button onclick="alert(\'Customization saving isn\\\'t wired up in this version yet.\')">Save</button></div>'


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # noqa: A002 - quiet by default
        pass

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html, status=200):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802 - required name by BaseHTTPRequestHandler
        if self.path == "/poll-data":
            with STATE_LOCK:
                self._send_json(dict(STATE["live_data"]))
        elif self.path == "/poll-alerts":
            with STATE_LOCK:
                events = STATE["alert_queue"]
                STATE["alert_queue"] = []
            self._send_json(events)
        elif self.path == "/status":
            with STATE_LOCK:
                self._send_json({"twitchStatus": STATE["twitch_status"], "twitchError": STATE["twitch_error"]})
        elif self.path in ("/setup", "/"):
            creds = load_credentials()
            html = SETUP_PAGE_TEMPLATE.format(
                overlay_name=MANIFEST.get("overlayName", "Overlay"),
                port=MANIFEST.get("port", 8420),
                twitch_client_id=creds.get("twitchClientId", ""),
                twitch_token=creds.get("twitchToken", ""),
                customization_card=customization_card_html(),
            )
            self._send_html(html)
        elif self.path == "/custom-overlay/standalone/overlay.html":
            try:
                with open(OVERLAY_PATH, "r", encoding="utf-8") as f:
                    self._send_html(f.read())
            except OSError:
                self._send_html("<h1>overlay.html not found</h1>", status=404)
        else:
            self._send_html("<h1>Not found</h1>", status=404)

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {}
        if self.path == "/save-credentials":
            creds = load_credentials()
            creds.update({k: v for k, v in payload.items() if isinstance(v, str)})
            save_credentials(creds)
            self._send_json({"ok": True})
        elif self.path == "/test-alert":
            with STATE_LOCK:
                STATE["alert_queue"].append({"kind": "follow", "user": "TestViewer", "message": "just followed! (test)"})
            self._send_json({"ok": True})
        else:
            self._send_json({"error": "not found"}, status=404)


def main():
    port = int(MANIFEST.get("port", 8420))
    threading.Thread(target=twitch_poll_loop, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"StreamerSuite standalone overlay helper running at http://127.0.0.1:{port}/setup")
    print("Open that URL to connect your accounts. Leave this window open while streaming.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
