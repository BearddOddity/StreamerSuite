#!/usr/bin/env python3
"""StreamerSuite standalone overlay helper (Mac/Linux).

Runs entirely from the Python standard library (no `pip install` needed).
Serves this folder's overlay.html (and any other overlay folder that
registers with it — see "Shared helper" below), hosts a local setup page to
connect your own Twitch/Kick accounts, and polls those platforms on your
behalf so bound fields/alerts stay live.

Shared helper: if you've been given more than one StreamerSuite overlay,
you only ever need ONE of these running at a time. When a second (or
third...) overlay's helper.py is launched, it notices one is already
running, hands its own folder over to it, and exits — the already-running
one then serves every overlay you've registered, at its own URL, off the
same port, sharing one set of connected credentials. The registry pointer
lives at ~/.streamersuite_portable_helper.json.

Kick only exposes live viewer count/status through its public API — no
follower/sub counts or a way to detect a fresh follow, so Kick alerts
aren't implemented (see the setup page for status).

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
OVERLAY_PATH = os.path.join(HERE, "overlay.html")

REGISTRY_PATH = os.path.join(os.path.expanduser("~"), ".streamersuite_portable_helper.json")
REGISTERED_DIRS_PATH = os.path.join(os.path.expanduser("~"), ".streamersuite_portable_helper_overlays.json")
CREDENTIALS_PATH = os.path.join(os.path.expanduser("~"), ".streamersuite_portable_helper_credentials.json")

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    MANIFEST = json.load(f)

STATE_LOCK = threading.Lock()
STATE = {
    "live_data": {},
    "alert_queue": [],
    "twitch_status": "disconnected",  # disconnected | connecting | connected | error
    "twitch_error": "",
    "kick_status": "disconnected",
    "kick_error": "",
    "last_follower_id": None,
    # Absolute paths of every overlay folder currently being served —
    # always includes HERE (this folder), plus any other folder that
    # registered with this process. Each has its own manifest.json (for
    # overlayId/overlayName/platforms) and overlay.html.
    "registered_dirs": [HERE],
}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def load_credentials():
    return load_json(CREDENTIALS_PATH, {})


def save_credentials(creds):
    save_json(CREDENTIALS_PATH, creds)


def persist_registered_dirs():
    with STATE_LOCK:
        dirs = list(STATE["registered_dirs"])
    save_json(REGISTERED_DIRS_PATH, dirs)


def load_manifest_for(dir_path):
    try:
        with open(os.path.join(dir_path, "manifest.json"), "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def registered_manifests():
    """{overlayId: (dir_path, manifest)} for every currently-registered,
    still-readable overlay folder — a folder the recipient later deleted
    or moved just silently drops out rather than crashing the helper."""
    with STATE_LOCK:
        dirs = list(STATE["registered_dirs"])
    out = {}
    for d in dirs:
        m = load_manifest_for(d)
        if m and m.get("overlayId"):
            out[m["overlayId"]] = (d, m)
    return out


def any_platform(platform):
    return any(platform in (m.get("platforms") or []) for _, m in registered_manifests().values())


def http_get_json(url, timeout=3):
    req = urllib.request.Request(url, headers={"User-Agent": "streamersuite-portable-helper"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def try_join_existing_helper():
    """If a shared helper is already running (per the registry pointer file)
    and actually answers, hand this overlay's own folder to it and return
    True so main() can exit without binding a second server. A stale
    registry (process no longer running) is treated the same as no
    registry at all — this process goes on to become the shared helper."""
    registry = load_json(REGISTRY_PATH, None)
    if not isinstance(registry, dict) or not registry.get("port"):
        return False
    port = registry["port"]
    try:
        ping = http_get_json(f"http://127.0.0.1:{port}/ping")
        if not ping.get("ok"):
            return False
    except (OSError, urllib.error.URLError, ValueError):
        return False
    try:
        body = json.dumps({"dir": HERE}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/register",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            json.loads(resp.read().decode("utf-8"))
        print(f"A StreamerSuite helper is already running for you at http://127.0.0.1:{port}/setup")
        print("This overlay has been added to it — open that URL to see it and connect your accounts.")
        return True
    except (OSError, urllib.error.URLError):
        return False


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


def twitch_poll_once():
    creds = load_credentials()
    token = creds.get("twitchToken", "").strip()
    client_id = creds.get("twitchClientId", "").strip()
    if not token or not client_id:
        with STATE_LOCK:
            STATE["twitch_status"] = "disconnected"
        return
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


def kick_get(path, token, params=None):
    url = "https://api.kick.com/public/v1" + path
    if params:
        query = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items())
        url = f"{url}?{query}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def kick_poll_once():
    """Kick's public API is slug-based (not derived from the token the way
    Twitch's is), so the recipient supplies both their own access token AND
    their channel slug. Only live viewer count/status is available this
    way — no follower/sub totals, and no event stream to diff for a
    synthesized "follow" alert the way Twitch's poll loop does, so
    kick_status can reach "connected" but the alert queue never gets a
    Kick entry from here."""
    creds = load_credentials()
    token = creds.get("kickToken", "").strip()
    slug = creds.get("kickSlug", "").strip()
    if not token or not slug:
        with STATE_LOCK:
            STATE["kick_status"] = "disconnected"
        return
    try:
        with STATE_LOCK:
            STATE["kick_status"] = "connecting"
        channels = kick_get("/channels", token, {"slug": slug})
        chan = (channels.get("data") or [{}])[0]
        stream = chan.get("stream") or {}
        with STATE_LOCK:
            STATE["live_data"]["kick_viewers"] = stream.get("viewer_count", 0)
            STATE["live_data"]["kick_live"] = bool(stream.get("is_live"))
            STATE["kick_status"] = "connected"
            STATE["kick_error"] = ""
    except Exception as e:  # noqa: BLE001 - this loop must never die
        with STATE_LOCK:
            STATE["kick_status"] = "error"
            STATE["kick_error"] = str(e)


def poll_loop():
    """Runs forever in the background, refreshing STATE every ~30s — only
    polls a platform at all when at least one currently-registered overlay
    actually lists it as needed, so a Twitch-only overlay never wastes a
    call on Kick and vice versa."""
    while True:
        if any_platform("twitch"):
            twitch_poll_once()
        else:
            with STATE_LOCK:
                STATE["twitch_status"] = "disconnected"
        if any_platform("kick"):
            kick_poll_once()
        else:
            with STATE_LOCK:
                STATE["kick_status"] = "disconnected"
        time.sleep(30)


SETUP_PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>StreamerSuite Overlay Helper</title>
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
  code {{ background: #0a0a0a; padding: 2px 6px; border-radius: 4px; word-break: break-all; }}
  a {{ color: #a970ff; }}
  ul {{ padding-left: 18px; margin: 6px 0; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>StreamerSuite Overlay Helper</h1>
  <p class="muted">One helper, every overlay you've been given — credentials below are shared across all of them.</p>

  <div class="card">
    <h3>Your overlays</h3>
    <ul>{overlay_list}</ul>
  </div>

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
    <h3>Kick <span id="kick-status" class="status disconnected">checking…</span></h3>
    <p class="muted">Paste your own access token and channel slug (the name in your Kick URL).
      Kick's API only exposes live viewer count/status this way — no follower/sub totals,
      and no live "follow" alerts.</p>
    <label>Channel Slug</label>
    <input type="text" id="kickSlug" value="{kick_slug}">
    <label>Access Token</label>
    <input type="password" id="kickToken" value="{kick_token}">
    <button onclick="saveCredentials()">Save &amp; Connect</button>
  </div>

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
      kickSlug: document.getElementById("kickSlug").value,
      kickToken: document.getElementById("kickToken").value,
    }}),
  }}).then(refreshStatus);
}}
function sendTestAlert() {{
  fetch("/test-alert", {{ method: "POST" }});
}}
function refreshStatus() {{
  fetch("/status").then(function(r) {{ return r.json(); }}).then(function(s) {{
    var t = document.getElementById("twitch-status");
    t.textContent = s.twitchStatus;
    t.className = "status " + s.twitchStatus;
    var k = document.getElementById("kick-status");
    k.textContent = s.kickStatus;
    k.className = "status " + s.kickStatus;
  }}).catch(function() {{}});
}}
refreshStatus();
setInterval(refreshStatus, 4000);
</script>
</body>
</html>
"""


def overlay_list_html(port):
    items = []
    for overlay_id, (_, m) in sorted(registered_manifests().items()):
        name = m.get("overlayName", overlay_id)
        items.append(
            f'<li>{name} — <code>http://127.0.0.1:{port}/custom-overlay/{overlay_id}/overlay.html</code></li>'
        )
    return "".join(items) if items else "<li>None registered</li>"


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
        if self.path == "/ping":
            self._send_json({"ok": True})
        elif self.path == "/poll-data":
            with STATE_LOCK:
                self._send_json(dict(STATE["live_data"]))
        elif self.path == "/poll-alerts":
            with STATE_LOCK:
                events = STATE["alert_queue"]
                STATE["alert_queue"] = []
            self._send_json(events)
        elif self.path == "/status":
            with STATE_LOCK:
                self._send_json({
                    "twitchStatus": STATE["twitch_status"],
                    "twitchError": STATE["twitch_error"],
                    "kickStatus": STATE["kick_status"],
                    "kickError": STATE["kick_error"],
                })
        elif self.path in ("/setup", "/"):
            creds = load_credentials()
            port = int(MANIFEST.get("port", 8420))
            html = SETUP_PAGE_TEMPLATE.format(
                overlay_list=overlay_list_html(port),
                port=port,
                twitch_client_id=creds.get("twitchClientId", ""),
                twitch_token=creds.get("twitchToken", ""),
                kick_slug=creds.get("kickSlug", ""),
                kick_token=creds.get("kickToken", ""),
            )
            self._send_html(html)
        elif self.path.startswith("/custom-overlay/"):
            overlay_id = self.path[len("/custom-overlay/"):].split("/")[0]
            manifests = registered_manifests()
            entry = manifests.get(overlay_id)
            if not entry:
                self._send_html("<h1>overlay not found (not registered with this helper)</h1>", status=404)
                return
            dir_path, _ = entry
            try:
                with open(os.path.join(dir_path, "overlay.html"), "r", encoding="utf-8") as f:
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
        if self.path == "/register":
            dir_path = payload.get("dir")
            if isinstance(dir_path, str) and load_manifest_for(dir_path):
                with STATE_LOCK:
                    if dir_path not in STATE["registered_dirs"]:
                        STATE["registered_dirs"].append(dir_path)
                persist_registered_dirs()
                self._send_json({"ok": True})
            else:
                self._send_json({"ok": False, "error": "no manifest.json at that folder"}, status=400)
        elif self.path == "/save-credentials":
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
    if try_join_existing_helper():
        return

    port = int(MANIFEST.get("port", 8420))

    # Becoming the shared helper: claim the registry pointer, and pick back
    # up any overlay folders registered by a previous run of this same
    # process (so a restart doesn't lose overlays registered earlier —
    # a folder that's since been moved/deleted just quietly drops out when
    # registered_manifests() can't read its manifest.json anymore).
    save_json(REGISTRY_PATH, {"port": port})
    previously_registered = load_json(REGISTERED_DIRS_PATH, [])
    with STATE_LOCK:
        for d in previously_registered:
            if d not in STATE["registered_dirs"]:
                STATE["registered_dirs"].append(d)
    persist_registered_dirs()

    threading.Thread(target=poll_loop, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"StreamerSuite standalone overlay helper running at http://127.0.0.1:{port}/setup")
    print("Open that URL to connect your accounts. Leave this window open while streaming.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
