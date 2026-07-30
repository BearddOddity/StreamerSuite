#!/usr/bin/env python3
"""StreamerSuite standalone overlay helper (Mac/Linux).

Runs entirely from the Python standard library (no `pip install` needed).
Serves this folder's overlay.html (and any other overlay folder that
registers with it — see "Shared helper" below), hosts a local setup page to
connect your own Twitch/Kick/YouTube/Chaturbate/Streamer.bot, and
polls/relays those platforms on your behalf so bound fields/alerts stay
live.

Shared helper: if you've been given more than one StreamerSuite overlay,
you only ever need ONE of these running at a time. When a second (or
third...) overlay's helper.py is launched, it notices one is already
running, hands its own folder over to it, and exits — the already-running
one then serves every overlay you've registered, at its own URL, off the
same port, sharing one set of connected credentials. The registry pointer
lives at ~/.streamersuite_portable_helper.json. Alerts are scoped
per-overlay (see push_alert) — an overlay only ever receives an alert from
a platform its OWN manifest.json actually lists.

Kick's polling connection (channel slug + token) only gives live viewer
count/status — no follower/sub totals via that path. Kick DOES push real
follow/sub/tip events via webhooks, but only to a public URL, which this
loopback-only helper isn't — see the Kick card's "Real-time alerts"
section for the tunnel-URL workaround, and push_alert's kick webhook
route for why it's not signature-verified yet (docs.kick.com was
unreachable while building this).

Streamer.bot relays your latest chat message (any platform Streamer.bot
itself is connected to, including YouTube — StreamerSuite has no direct
YouTube chat API of its own either) AND real alerts (both Streamer.bot's
own built-in per-platform triggers and any "Custom" event a Streamer.bot
Action broadcasts — those aren't platform-defined, they're whatever the
streamer set up) into the overlay, using the same WebSocket + salt/
challenge auth protocol StreamerSuite's own Connections & Keys uses. Since
Python's standard library has no WebSocket client, this file
hand-implements the minimal RFC 6455 client/framing it needs (WSClient
below, with TLS added for Joystick's wss:// gateway) rather than depending
on a third-party package the recipient would have to `pip install`.

Joystick.tv's OAuth PKCE authorize/token flow and ActionCable gateway
connect/subscribe/tip-parsing are direct ports of StreamerSuite's own
verified Joystick integration (multichat.rs's oauth_login,
useAlertsFeed.ts's Joystick effect) — real tip alerts.

This is provided as-is by whoever gave you this overlay; troubleshooting
isn't guaranteed. See README.txt for setup steps.
"""
import base64
import hashlib
import json
import os
import re
import socket
import ssl
import struct
import threading
import time
import urllib.parse
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

# RLock, not Lock: push_alert() is always called from inside an existing
# "with STATE_LOCK:" block, and it calls registered_manifests(), which
# itself acquires STATE_LOCK — a plain Lock would deadlock the same thread
# trying to acquire it twice.
STATE_LOCK = threading.RLock()
STATE = {
    "live_data": {},
    # overlayId -> list of queued alerts, NOT one shared queue — an alert
    # only ever reaches an overlay whose own manifest.json actually lists
    # the platform it came from (see push_alert below), so a YouTube Super
    # Chat never pops up on an overlay that only asked for Twitch.
    "alert_queues": {},
    "twitch_status": "disconnected",  # disconnected | connecting | connected | error
    "twitch_error": "",
    "kick_status": "disconnected",
    "kick_error": "",
    "youtube_status": "disconnected",
    "youtube_error": "",
    "youtube_chat_page_token": None,
    "chaturbate_status": "disconnected",
    "chaturbate_error": "",
    "chaturbate_next_url": None,
    "streamerbot_status": "disconnected",
    "streamerbot_error": "",
    "joystick_status": "disconnected",
    "joystick_error": "",
    # In-flight PKCE state for the OAuth login currently underway (if any) —
    # a single in-memory attempt at a time is enough for this local-only flow.
    "joystick_oauth_state": None,
    "joystick_oauth_verifier": None,
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


def push_alert(platform, alert):
    """Queues `alert` (came from `platform`) onto every currently-registered
    overlay whose OWN manifest.json lists that platform — never a single
    shared queue. Call sites must hold STATE_LOCK already (matches every
    other STATE mutation in this file)."""
    for overlay_id, (_, m) in registered_manifests().items():
        if platform in (m.get("platforms") or []):
            STATE["alert_queues"].setdefault(overlay_id, []).append(alert)


# --- Minimal hand-rolled RFC 6455 WebSocket client, stdlib-only ---
# Streamer.bot's own protocol (and Joystick.tv's realtime gateway) is
# WebSocket-only, and Python's standard library has no WebSocket client —
# rather than depend on a package the recipient would need to `pip install`,
# this implements just enough of the spec: the HTTP Upgrade handshake,
# masked client->server frames (required by RFC 6455), fragmented-message
# reassembly, and automatic ping/pong. Verified against a real WebSocket
# server (the `websockets` package) during development, including the
# fragmentation, ping/pong, and clean-close paths.
_WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def _ws_handshake(host, port, path="/", timeout=5, use_tls=False, subprotocol=None):
    sock = socket.create_connection((host, port), timeout=timeout)
    if use_tls:
        sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
    key = base64.b64encode(os.urandom(16)).decode()
    extra_header = f"Sec-WebSocket-Protocol: {subprotocol}\r\n" if subprotocol else ""
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        f"{extra_header}"
        "\r\n"
    ).encode()
    sock.sendall(request)
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("connection closed during WebSocket handshake")
        response += chunk
    header_bytes, _, rest = response.partition(b"\r\n\r\n")
    header_text = header_bytes.decode("latin-1", errors="replace")
    status_line = header_text.split("\r\n", 1)[0]
    if " 101 " not in status_line:
        raise ConnectionError(f"WebSocket handshake failed: {status_line}")
    expected_accept = base64.b64encode(hashlib.sha1((key + _WS_GUID).encode()).digest()).decode()
    if expected_accept.lower() not in header_text.lower():
        raise ConnectionError("WebSocket handshake failed: Sec-WebSocket-Accept mismatch")
    sock.settimeout(None)
    return sock, rest


class WSClient:
    def __init__(self, sock, initial_buffer=b""):
        self.sock = sock
        self.buf = initial_buffer

    def _recv_exact(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("WebSocket connection closed")
            self.buf += chunk
        data, self.buf = self.buf[:n], self.buf[n:]
        return data

    def send_text(self, text):
        self._send_frame(0x1, text.encode("utf-8"))

    def _send_frame(self, opcode, payload):
        # Client->server frames MUST be masked per RFC 6455 5.3.
        mask_key = os.urandom(4)
        masked = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        length = len(payload)
        header = bytearray()
        header.append(0x80 | opcode)  # FIN=1, opcode
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", length)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", length)
        header += mask_key
        self.sock.sendall(bytes(header) + masked)

    def recv_message(self):
        """Reads one full (possibly fragmented) message, replying to pings
        automatically, and returns its decoded text — or None once the peer
        has cleanly closed the connection."""
        parts = []
        while True:
            first2 = self._recv_exact(2)
            b0, b1 = first2[0], first2[1]
            fin = b0 & 0x80
            opcode = b0 & 0x0F
            masked = b1 & 0x80
            length = b1 & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._recv_exact(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._recv_exact(8))[0]
            mask_key = self._recv_exact(4) if masked else None
            payload = self._recv_exact(length)
            if mask_key:
                payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
            if opcode == 0x8:  # close
                return None
            if opcode == 0x9:  # ping
                self._send_frame(0xA, payload)
                continue
            if opcode == 0xA:  # pong
                continue
            parts.append(payload)
            if fin:
                break
        return b"".join(parts).decode("utf-8", errors="replace")

    def close(self):
        try:
            self._send_frame(0x8, b"")
        except OSError:
            pass
        self.sock.close()


def ws_connect(host, port, path="/", timeout=5, use_tls=False, subprotocol=None):
    sock, leftover = _ws_handshake(host, port, path, timeout, use_tls, subprotocol)
    return WSClient(sock, leftover)


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
                    push_alert("twitch", {
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


def youtube_get(path, api_key, params=None):
    url = "https://www.googleapis.com/youtube/v3" + path
    all_params = dict(params or {})
    all_params["key"] = api_key
    query = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in all_params.items())
    req = urllib.request.Request(f"{url}?{query}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def youtube_poll_once():
    """Uses the recipient's own YouTube Data API v3 key (a free key from
    Google Cloud Console, not an OAuth app) — enough for public data: find
    the channel's current live broadcast, its concurrent viewer count, and
    poll its live chat for new Super Chat / new membership events. No
    regular chat messages are surfaced as alerts, only those two paid
    events, and only while a live broadcast is actually found."""
    creds = load_credentials()
    api_key = creds.get("youtubeApiKey", "").strip()
    channel_id = creds.get("youtubeChannelId", "").strip()
    if not api_key or not channel_id:
        with STATE_LOCK:
            STATE["youtube_status"] = "disconnected"
        return
    try:
        with STATE_LOCK:
            STATE["youtube_status"] = "connecting"
        search = youtube_get("/search", api_key, {
            "part": "id", "channelId": channel_id, "eventType": "live", "type": "video",
        })
        items = search.get("items") or []
        if not items:
            with STATE_LOCK:
                STATE["youtube_status"] = "connected"
                STATE["youtube_error"] = ""
                STATE["live_data"]["youtube_viewers"] = 0
                STATE["live_data"]["youtube_live"] = False
            return
        video_id = items[0]["id"]["videoId"]
        videos = youtube_get("/videos", api_key, {"part": "liveStreamingDetails", "id": video_id})
        details = ((videos.get("items") or [{}])[0]).get("liveStreamingDetails", {})
        live_chat_id = details.get("activeLiveChatId")

        with STATE_LOCK:
            STATE["live_data"]["youtube_viewers"] = int(details.get("concurrentViewers", 0))
            STATE["live_data"]["youtube_live"] = True

        if live_chat_id:
            chat_params = {"liveChatId": live_chat_id, "part": "snippet,authorDetails"}
            if STATE.get("youtube_chat_page_token"):
                chat_params["pageToken"] = STATE["youtube_chat_page_token"]
            chat = youtube_get("/liveChat/messages", api_key, chat_params)
            with STATE_LOCK:
                STATE["youtube_chat_page_token"] = chat.get("nextPageToken")
            for item in chat.get("items") or []:
                snippet = item.get("snippet", {})
                kind = snippet.get("type")
                author = item.get("authorDetails", {}).get("displayName", "Someone")
                if kind == "superChatEvent":
                    amount = snippet.get("superChatDetails", {}).get("amountDisplayString", "")
                    with STATE_LOCK:
                        push_alert("youtube", {"kind": "cheer", "user": author, "message": f"sent a Super Chat ({amount})!"})
                elif kind == "newSponsorEvent":
                    with STATE_LOCK:
                        push_alert("youtube", {"kind": "sub", "user": author, "message": "just became a member!"})

        with STATE_LOCK:
            STATE["youtube_status"] = "connected"
            STATE["youtube_error"] = ""
    except Exception as e:  # noqa: BLE001 - this loop must never die
        with STATE_LOCK:
            STATE["youtube_status"] = "error"
            STATE["youtube_error"] = str(e)


def chaturbate_poll_once():
    """Chaturbate's own Events API is a long-poll (the request itself
    blocks server-side up to `timeout` seconds waiting for something to
    report), so this call doubles as this iteration's whole 30s wait
    instead of running alongside a fixed sleep — same mechanic
    StreamerSuite's own chaturbate_poll_events uses. Tip/follow events come
    back as real push-like data (not diffed), from the events array."""
    creds = load_credentials()
    username = creds.get("chaturbateUsername", "").strip()
    token = creds.get("chaturbateToken", "").strip()
    if not username or not token:
        with STATE_LOCK:
            STATE["chaturbate_status"] = "disconnected"
        time.sleep(30)
        return
    try:
        with STATE_LOCK:
            STATE["chaturbate_status"] = "connecting"
        next_url = STATE.get("chaturbate_next_url") or (
            f"https://eventsapi.chaturbate.com/events/{urllib.request.quote(username)}/{urllib.request.quote(token)}/?timeout=25"
        )
        req = urllib.request.Request(next_url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        with STATE_LOCK:
            STATE["chaturbate_next_url"] = payload.get("nextUrl")
            STATE["chaturbate_status"] = "connected"
            STATE["chaturbate_error"] = ""
        for event in payload.get("events") or []:
            method = event.get("method")
            obj = event.get("object", {})
            if method == "tip":
                tip = obj.get("tip", {})
                user = obj.get("user", {}).get("username", "Someone")
                with STATE_LOCK:
                    push_alert("chaturbate", {"kind": "tip", "user": user, "message": f"tipped {tip.get('tokens', 0)} tokens!"})
            elif method == "follow":
                user = obj.get("user", {}).get("username", "Someone")
                with STATE_LOCK:
                    push_alert("chaturbate", {"kind": "follow", "user": user, "message": "just followed!"})
    except Exception as e:  # noqa: BLE001 - this loop must never die
        with STATE_LOCK:
            STATE["chaturbate_status"] = "error"
            STATE["chaturbate_error"] = str(e)
            STATE["chaturbate_next_url"] = None
        time.sleep(30)


def poll_loop():
    """Runs forever in the background, refreshing STATE every ~30s — only
    polls a platform at all when at least one currently-registered overlay
    actually lists it as needed, so a Twitch-only overlay never wastes a
    call on Kick and vice versa. Chaturbate is deliberately NOT polled here
    — its Events API is a long-poll (the request itself blocks for up to
    25s), which would starve every other platform's 30s cadence if it ran
    in this same loop, so it gets its own thread (chaturbate_loop)."""
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
        if any_platform("youtube"):
            youtube_poll_once()
        else:
            with STATE_LOCK:
                STATE["youtube_status"] = "disconnected"
        time.sleep(30)


def chaturbate_loop():
    """Its own thread since chaturbate_poll_once's long-poll blocks for up
    to 25s per call — running it here keeps that wait from delaying
    Twitch/Kick/YouTube's fixed 30s cadence in poll_loop."""
    while True:
        if any_platform("chaturbate"):
            chaturbate_poll_once()
        else:
            with STATE_LOCK:
                STATE["chaturbate_status"] = "disconnected"
            time.sleep(30)


def streamerbot_sha256_b64(s):
    return base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode()


# Best-effort event-type -> (overlay alert kind, default message) for
# Streamer.bot's built-in per-platform triggers — see streamerbot_loop's
# own docstring for what "best-effort" means here.
_STREAMERBOT_ALERT_KIND = {
    "Follow": "follow", "Sub": "sub", "ReSub": "sub", "GiftSub": "sub",
    "GiftedSubscriptions": "sub", "NewSponsor": "sub",
    "Cheer": "cheer", "SuperChat": "cheer", "Raid": "raid",
}
_STREAMERBOT_ALERT_KIND_MESSAGE = {
    "Follow": "just followed!", "Sub": "subscribed!", "ReSub": "resubscribed!",
    "GiftSub": "gifted a sub!", "GiftedSubscriptions": "gifted subs!",
    "NewSponsor": "just became a member!", "Cheer": "sent cheer bits!",
    "SuperChat": "sent a Super Chat!", "Raid": "raided the channel!",
}


def streamerbot_extract_user(data):
    """Streamer.bot's own event payloads vary by platform/event type
    (no single confirmed field name), so this tries several plausible
    ones defensively rather than assuming one — same defensive approach
    StreamerSuite's own fetch_joystick_identity uses for the same reason
    (an undocumented response shape)."""
    user_obj = data.get("user")
    if isinstance(user_obj, dict):
        for key in ("display", "displayName", "name", "username"):
            v = user_obj.get(key)
            if isinstance(v, str) and v:
                return v
    for key in ("displayName", "userName", "user_name", "name"):
        v = data.get(key)
        if isinstance(v, str) and v:
            return v
    return None


def streamerbot_loop():
    """Relays chat into live_data["latest_chat"], and real alerts into
    push_alert("streamerbot", ...), from a Streamer.bot instance already
    running on the RECIPIENT's own machine (not something this helper
    starts) — the same connect + salt/challenge auth algorithm as
    StreamerSuite's own src/lib/streamerbot.ts, verified against a real
    RFC 6455 server during development (see WSClient above). The
    Subscribe request/event shape below is Streamer.bot's own public
    WebSocket API — StreamerSuite's own code only ever calls DoAction, so
    this specific part (subscribing to receive events, not just send
    actions) is best-effort against Streamer.bot's public docs, not
    verified against StreamerSuite's own code the way the connect+auth
    handshake is.

    Streamer.bot alerts aren't a fixed platform-defined list — they're
    whatever the STREAMER set up in their own Streamer.bot instance. Two
    kinds are handled: (1) Streamer.bot's own built-in per-platform
    triggers (Follow/Sub/Cheer/Raid etc. — subscribed to below alongside
    chat), which fire regardless of any custom setup, and (2) a "Custom"
    global event — Streamer.bot's own general-purpose mechanism for a
    user's Action to broadcast an arbitrary named event with an arbitrary
    payload, which is the normal way a Streamer.bot user wires up
    something this helper has no built-in knowledge of. Custom events are
    parsed generically (whatever name/fields the user's own Action sends)
    rather than assuming a fixed shape."""
    while True:
        if not any_platform("streamerbot"):
            with STATE_LOCK:
                STATE["streamerbot_status"] = "disconnected"
            time.sleep(10)
            continue
        creds = load_credentials()
        host = creds.get("streamerbotHost", "").strip() or "127.0.0.1"
        port_str = creds.get("streamerbotPort", "").strip() or "8080"
        password = creds.get("streamerbotPassword", "").strip()
        try:
            port = int(port_str)
        except ValueError:
            port = 8080
        try:
            with STATE_LOCK:
                STATE["streamerbot_status"] = "connecting"
            ws = ws_connect(host, port, "/", timeout=5)
            try:
                raw = ws.recv_message()
                if raw is None:
                    raise ConnectionError("Streamer.bot closed the connection during handshake")
                msg = json.loads(raw)
                auth = msg.get("authentication")
                if auth and password:
                    secret = streamerbot_sha256_b64(password + auth["salt"])
                    authentication = streamerbot_sha256_b64(secret + auth["challenge"])
                    ws.send_text(json.dumps({"request": "Authenticate", "authentication": authentication, "id": "connect"}))
                    raw = ws.recv_message()
                    if raw is None:
                        raise ConnectionError("Streamer.bot closed the connection during authentication")
                    ack = json.loads(raw)
                    if ack.get("status") != "ok":
                        raise ConnectionError(ack.get("error") or "authentication failed — check the Streamer.bot password")
                # No password saved and the server didn't insist on one —
                # matches streamerbot.ts's own behavior of proceeding
                # unauthenticated in that case.

                ws.send_text(json.dumps({
                    "request": "Subscribe", "id": "streamersuite-portable",
                    "events": {
                        "General": ["Custom"],
                        "Twitch": ["ChatMessage", "Follow", "Sub", "ReSub", "GiftSub", "Cheer", "Raid"],
                        "YouTube": ["Message", "NewSponsor", "SuperChat"],
                        "Kick": ["ChatMessage", "Follow", "Sub", "GiftedSubscriptions"],
                    },
                }))

                with STATE_LOCK:
                    STATE["streamerbot_status"] = "connected"
                    STATE["streamerbot_error"] = ""

                while True:
                    raw = ws.recv_message()
                    if raw is None:
                        raise ConnectionError("Streamer.bot connection closed")
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    src = (event.get("event") or {}).get("source")
                    evt_type = (event.get("event") or {}).get("type")
                    data = event.get("data") or {}

                    if evt_type in ("ChatMessage", "Message"):
                        message_obj = data.get("message") or {}
                        text = message_obj.get("message")
                        user = (message_obj.get("user") or {}).get("display") or (message_obj.get("user") or {}).get("name")
                        if text:
                            with STATE_LOCK:
                                STATE["live_data"]["latest_chat"] = f"{user}: {text}" if user else text
                        continue

                    if src == "General" and evt_type == "Custom":
                        # Whatever the streamer's own Action broadcasts —
                        # no fixed shape to assume beyond "some named event".
                        name = data.get("event") or "custom"
                        user = streamerbot_extract_user(data)
                        message = data.get("message") or f"{name} triggered"
                        with STATE_LOCK:
                            push_alert("streamerbot", {"kind": name, "user": user or "Someone", "message": message})
                        continue

                    kind = _STREAMERBOT_ALERT_KIND.get(evt_type)
                    if kind and src in ("Twitch", "Kick", "YouTube"):
                        user = streamerbot_extract_user(data)
                        message = _STREAMERBOT_ALERT_KIND_MESSAGE.get(evt_type, "sent an alert!")
                        with STATE_LOCK:
                            push_alert("streamerbot", {"kind": kind, "user": user or "Someone", "message": message})
            finally:
                ws.close()
        except Exception as e:  # noqa: BLE001 - this loop must never die
            with STATE_LOCK:
                STATE["streamerbot_status"] = "error"
                STATE["streamerbot_error"] = str(e)
            time.sleep(10)


# --- Joystick.tv: OAuth PKCE (RFC 7636) + ActionCable gateway ---
# Every URL, header, and message shape below is copied from StreamerSuite's
# own verified Joystick integration — the PKCE authorize/token flow in
# src-tauri/src/multichat.rs's oauth_login (a genuine public PKCE client,
# no client_secret, checked against Joystick's own reference client at
# github.com/joysticktv/jtv), and the ActionCable gateway connect/subscribe/
# tip-parsing logic in src/apps/alerts-hub/useAlertsFeed.ts. Unlike
# Streamer.bot's Subscribe shape (best-effort, no real reference to check
# against), every piece of this is a direct port. What's NOT verified here
# is the wss:// TLS path through the hand-rolled WSClient itself, which was
# tested during development against a local TLS WebSocket server using the
# exact same subprotocol/message flow (see the ActionCable "Tipped" test),
# not against joystick.tv directly (no outbound network in that sandbox).
JOYSTICK_REDIRECT_PATH = "/joystick-oauth-callback"


def joystick_code_verifier():
    return base64.urlsafe_b64encode(os.urandom(48)).rstrip(b"=").decode()


def joystick_code_challenge(verifier):
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def joystick_redirect_uri(port):
    return f"http://127.0.0.1:{port}{JOYSTICK_REDIRECT_PATH}"


def joystick_fetch_identity(access_token):
    req = urllib.request.Request(
        "https://joystick.tv/api/v1/me/identity",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        return None
    for key in ("username", "slug", "display_name", "name"):
        v = body.get(key)
        if isinstance(v, str) and v:
            return v
    return None


def joystick_exchange_code(code, client_id, verifier, redirect_uri):
    body = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": verifier,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://joystick.tv/api/oauth/token",
        data=body,
        headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    access_token = payload.get("access_token")
    if not access_token:
        raise ValueError("Joystick didn't return an access token — check the Client ID")
    return access_token, payload.get("refresh_token", "")


_JOYSTICK_TIP_RE = re.compile(r"^(.+?)\s+tipped\s+(\d+)\s+tokens?(?:\s+for\s+(.+))?$", re.IGNORECASE)


def joystick_loop():
    """ActionCable gateway relay — Bearer JWT as a ?token= query param (not
    Basic auth, confirmed against Joystick's own reference client), same
    subscribe/tip-parsing logic as useAlertsFeed.ts's Joystick effect."""
    while True:
        if not any_platform("joystick"):
            with STATE_LOCK:
                STATE["joystick_status"] = "disconnected"
            time.sleep(10)
            continue
        creds = load_credentials()
        access_token = creds.get("joystickAccessToken", "").strip()
        if not access_token:
            with STATE_LOCK:
                STATE["joystick_status"] = "disconnected"
            time.sleep(10)
            continue
        try:
            with STATE_LOCK:
                STATE["joystick_status"] = "connecting"
            ws = ws_connect(
                "joystick.tv", 443, "/cable?token=" + urllib.parse.quote(access_token),
                timeout=5, use_tls=True, subprotocol="actioncable-v1-json",
            )
            try:
                ws.send_text(json.dumps({"command": "subscribe", "identifier": json.dumps({"channel": "GatewayChannel"})}))
                while True:
                    raw = ws.recv_message()
                    if raw is None:
                        raise ConnectionError("Joystick gateway closed the connection")
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if msg.get("type") == "confirm_subscription":
                        with STATE_LOCK:
                            STATE["joystick_status"] = "connected"
                            STATE["joystick_error"] = ""
                        continue
                    if msg.get("type") == "reject_subscription":
                        raise ConnectionError("Joystick rejected the gateway subscription")
                    inner = msg.get("message") or {}
                    if inner.get("event") == "StreamEvent" and inner.get("type") == "Tipped" and isinstance(inner.get("text"), str):
                        text = re.sub(r"<[^>]*>", "", inner["text"]).strip()
                        m = _JOYSTICK_TIP_RE.match(text)
                        if m:
                            user, tokens, note = m.group(1), m.group(2), m.group(3)
                            message = f'tipped for "{note}"' if note else "sent a tip!"
                            with STATE_LOCK:
                                push_alert("joystick", {"kind": "tip", "user": user, "message": message, "amount": tokens})
            finally:
                ws.close()
        except Exception as e:  # noqa: BLE001 - this loop must never die
            with STATE_LOCK:
                STATE["joystick_status"] = "error"
                STATE["joystick_error"] = str(e)
            time.sleep(10)


SETUP_PAGE_SHELL = """<!DOCTYPE html>
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

  {platform_cards}

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
{credential_fields}
    }}),
  }}).then(refreshStatus);
}}
function sendTestAlert() {{
  fetch("/test-alert", {{ method: "POST" }});
}}
function setStatus(id, value) {{
  var el = document.getElementById(id);
  el.textContent = value;
  el.className = "status " + value;
}}
function refreshStatus() {{
  fetch("/status").then(function(r) {{ return r.json(); }}).then(function(s) {{
{status_refresh}
  }}).catch(function() {{}});
}}
refreshStatus();
setInterval(refreshStatus, 4000);
</script>
</body>
</html>
"""

# One entry per platform the helper knows how to poll — (card HTML, the JS
# credential fields it contributes to saveCredentials()'s payload, the JS
# status-badge update line for refreshStatus()). Which of these actually
# appear on the setup page is driven entirely by what the CURRENTLY
# REGISTERED overlays' own manifests list under "platforms" (see
# needed_platforms() below) — an overlay the wizard was only told needs
# Twitch never shows a Kick/YouTube/Chaturbate card, even though this
# helper is technically capable of all four.
PLATFORM_CARDS = {
    "twitch": lambda creds: (
        '<div class="card">'
        '<h3>Twitch <span id="twitch-status" class="status disconnected">checking…</span></h3>'
        '<p class="muted">Paste a Client ID + Access Token from your own Twitch application '
        '(not the overlay creator\'s). Needs the <code>moderator:read:followers</code> and '
        '<code>channel:read:subscriptions</code> scopes for follower/sub counts.</p>'
        '<label>Client ID</label>'
        f'<input type="text" id="twitchClientId" value="{creds.get("twitchClientId", "")}">'
        '<label>Access Token</label>'
        f'<input type="password" id="twitchToken" value="{creds.get("twitchToken", "")}">'
        '<button onclick="saveCredentials()">Save &amp; Connect</button>'
        '<button class="secondary" onclick="sendTestAlert()">Send Test Alert</button>'
        '</div>'
    ),
    "kick": lambda creds: kick_card_html(creds),
    "youtube": lambda creds: (
        '<div class="card">'
        '<h3>YouTube <span id="youtube-status" class="status disconnected">checking…</span></h3>'
        '<p class="muted">Paste your own YouTube Data API v3 key (free from Google Cloud Console — '
        'no OAuth app needed) and your channel ID. Only works while you have an active live broadcast; '
        'gives viewer count plus Super Chat / new membership alerts. Regular chat isn\'t surfaced.</p>'
        '<label>Channel ID</label>'
        f'<input type="text" id="youtubeChannelId" value="{creds.get("youtubeChannelId", "")}">'
        '<label>API Key</label>'
        f'<input type="password" id="youtubeApiKey" value="{creds.get("youtubeApiKey", "")}">'
        '<button onclick="saveCredentials()">Save &amp; Connect</button>'
        '</div>'
    ),
    "chaturbate": lambda creds: (
        '<div class="card">'
        '<h3>Chaturbate <span id="chaturbate-status" class="status disconnected">checking…</span></h3>'
        '<p class="muted">Paste your own username and Events API token (generate one at '
        'chaturbate.com/statsapi/authtoken/). Gives real tip and follow alerts.</p>'
        '<label>Username</label>'
        f'<input type="text" id="chaturbateUsername" value="{creds.get("chaturbateUsername", "")}">'
        '<label>Events API Token</label>'
        f'<input type="password" id="chaturbateToken" value="{creds.get("chaturbateToken", "")}">'
        '<button onclick="saveCredentials()">Save &amp; Connect</button>'
        '</div>'
    ),
    "streamerbot": lambda creds: (
        '<div class="card">'
        '<h3>Streamer.bot <span id="streamerbot-status" class="status disconnected">checking…</span></h3>'
        '<p class="muted">Streamer.bot must already be running on this machine with its WebSocket Server '
        'enabled. Gives the latest chat message (any platform Streamer.bot itself is connected to, '
        'including YouTube). Leave Host/Port at their defaults unless you changed them in Streamer.bot.</p>'
        '<label>Host</label>'
        f'<input type="text" id="streamerbotHost" value="{creds.get("streamerbotHost", "127.0.0.1")}">'
        '<label>Port</label>'
        f'<input type="text" id="streamerbotPort" value="{creds.get("streamerbotPort", "8080")}">'
        '<label>Password (only if you set one in Streamer.bot)</label>'
        f'<input type="password" id="streamerbotPassword" value="{creds.get("streamerbotPassword", "")}">'
        '<button onclick="saveCredentials()">Save &amp; Connect</button>'
        '</div>'
    ),
    "joystick": lambda creds: joystick_card_html(creds),
}


def kick_webhook_path():
    return "/kick-webhook"


# Event type strings and general shape are best-effort — assembled from
# public discussion of Kick's webhook events (channel.followed,
# channel.subscription.new/renewal/gifts, kicks.gifted, chat.message.sent,
# livestream.status.updated, moderation.banned), not verified against
# docs.kick.com directly (unreachable — see the "NOT SIGNATURE-VERIFIED"
# comment at the /kick-webhook route). The exact JSON field names for the
# user who triggered the event aren't confirmed, so this tries several
# plausible nested paths defensively rather than assuming one.
_KICK_EVENT_KIND = {
    "channel.followed": "follow",
    "channel.subscription.new": "sub",
    "channel.subscription.renewal": "sub",
    "channel.subscription.gifts": "sub",
    "kicks.gifted": "tip",
}
_KICK_EVENT_MESSAGE = {
    "channel.followed": "just followed!",
    "channel.subscription.new": "subscribed!",
    "channel.subscription.renewal": "resubscribed!",
    "channel.subscription.gifts": "gifted subs!",
    "kicks.gifted": "sent Kicks!",
}


def kick_parse_webhook_event(event_type, payload):
    kind = _KICK_EVENT_KIND.get(event_type)
    if not kind:
        return None
    user = None
    for path in (
        ("follower", "username"), ("subscriber", "username"), ("gifter", "username"),
        ("user", "username"), ("broadcaster", "username"),
    ):
        node = payload
        for key in path:
            node = node.get(key) if isinstance(node, dict) else None
        if isinstance(node, str) and node:
            user = node
            break
    return {"kind": kind, "user": user or "Someone", "message": _KICK_EVENT_MESSAGE.get(event_type, "sent an alert!")}


def kick_card_html(creds):
    webhook_url = creds.get("kickWebhookUrl", "")
    return (
        '<div class="card">'
        '<h3>Kick <span id="kick-status" class="status disconnected">checking…</span></h3>'
        '<p class="muted">Paste your own access token and channel slug (the name in your Kick URL). '
        'Kick\'s API only exposes live viewer count/status this way — no follower/sub totals.</p>'
        '<label>Channel Slug</label>'
        f'<input type="text" id="kickSlug" value="{creds.get("kickSlug", "")}">'
        '<label>Access Token</label>'
        f'<input type="password" id="kickToken" value="{creds.get("kickToken", "")}">'
        '<button onclick="saveCredentials()">Save &amp; Connect</button>'
        '<hr style="border-color:#2a2a2a;margin:16px 0">'
        '<p class="muted"><strong>Real-time alerts (optional, more setup)</strong> — Kick only pushes '
        'follow/sub/tip events to a URL reachable from the internet, not to this helper directly '
        '(which only ever listens on your own machine). Run a tunnel tool (e.g. ngrok, cloudflared) '
        'pointing at this helper\'s port, paste the tunnel\'s public URL below, then register '
        f'<code>&lt;your tunnel URL&gt;{kick_webhook_path()}</code> as the Webhook URL in your Kick '
        'app\'s developer settings.</p>'
        '<p class="muted" style="color:#facc15">⚠ This endpoint doesn\'t verify Kick\'s webhook '
        'signature yet — treat your tunnel URL as something to keep private, not something to hand out.</p>'
        '<label>Tunnel URL</label>'
        f'<input type="text" id="kickWebhookUrl" placeholder="https://your-tunnel.example.com" value="{webhook_url}">'
        '<button onclick="saveCredentials()">Save Tunnel URL</button>'
        '</div>'
    )


def joystick_card_html(creds):
    username = creds.get("joystickUsername", "")
    connected_line = f'<p class="muted">Connected as {username}</p>' if username else ""
    redirect_uri = joystick_redirect_uri(int(MANIFEST.get("port", 8420)))
    return (
        '<div class="card">'
        '<h3>Joystick.tv <span id="joystick-status" class="status disconnected">checking…</span></h3>'
        '<p class="muted">Register your own OAuth app at your Joystick.tv bot settings, using this exact '
        f'Redirect URI: <code>{redirect_uri}</code> — then paste its '
        'Client ID below and click Connect. Gives real tip alerts.</p>'
        '<label>Client ID</label>'
        f'<input type="text" id="joystickClientId" value="{creds.get("joystickClientId", "")}">'
        '<button onclick="saveCredentials()">Save</button>'
        '<button class="secondary" onclick="window.location=\'/joystick-connect\'">Connect via Joystick.tv</button>'
        f'{connected_line}'
        '</div>'
    )

PLATFORM_CREDENTIAL_FIELDS = {
    "twitch": ['twitchClientId: document.getElementById("twitchClientId").value',
               'twitchToken: document.getElementById("twitchToken").value'],
    "kick": ['kickSlug: document.getElementById("kickSlug").value',
             'kickToken: document.getElementById("kickToken").value',
             'kickWebhookUrl: document.getElementById("kickWebhookUrl").value'],
    "youtube": ['youtubeChannelId: document.getElementById("youtubeChannelId").value',
                'youtubeApiKey: document.getElementById("youtubeApiKey").value'],
    "chaturbate": ['chaturbateUsername: document.getElementById("chaturbateUsername").value',
                   'chaturbateToken: document.getElementById("chaturbateToken").value'],
    "streamerbot": ['streamerbotHost: document.getElementById("streamerbotHost").value',
                    'streamerbotPort: document.getElementById("streamerbotPort").value',
                    'streamerbotPassword: document.getElementById("streamerbotPassword").value'],
    "joystick": ['joystickClientId: document.getElementById("joystickClientId").value'],
}

PLATFORM_STATUS_IDS = {
    "twitch": ("twitch-status", "twitchStatus"),
    "kick": ("kick-status", "kickStatus"),
    "youtube": ("youtube-status", "youtubeStatus"),
    "chaturbate": ("chaturbate-status", "chaturbateStatus"),
    "streamerbot": ("streamerbot-status", "streamerbotStatus"),
    "joystick": ("joystick-status", "joystickStatus"),
}


def needed_platforms():
    """The union of every currently-registered overlay's own "platforms"
    list — what actually decides which credential cards show up, not the
    fixed set of platforms this helper happens to know how to poll. An
    overlay the export wizard was only told needs Twitch never grows a
    Kick/YouTube/Chaturbate card just because this helper could serve one."""
    needed = set()
    for _, m in registered_manifests().values():
        needed.update(m.get("platforms") or [])
    return needed


def overlay_list_html(port):
    items = []
    for overlay_id, (_, m) in sorted(registered_manifests().items()):
        name = m.get("overlayName", overlay_id)
        items.append(
            f'<li>{name} — <code>http://127.0.0.1:{port}/custom-overlay/{overlay_id}/overlay.html</code></li>'
        )
    return "".join(items) if items else "<li>None registered</li>"


def setup_page_html(port, creds):
    platforms = [p for p in ("twitch", "kick", "youtube", "chaturbate", "streamerbot", "joystick") if p in needed_platforms()]
    if not platforms:
        # No registered overlay declares ANY platform (a fully static
        # overlay, or none registered yet) — nothing to connect, so no
        # cards at all rather than every card StreamerSuite happens to know.
        cards_html = '<div class="card"><p class="muted">This overlay doesn\'t use any live platform data — nothing to connect.</p></div>'
        credential_fields = ""
        status_refresh = ""
    else:
        cards_html = "\n  ".join(PLATFORM_CARDS[p](creds) for p in platforms)
        credential_fields = ",\n".join(f"      {line}" for p in platforms for line in PLATFORM_CREDENTIAL_FIELDS[p])
        status_refresh = "\n".join(
            f'    setStatus("{el_id}", s.{status_key});' for p in platforms for el_id, status_key in [PLATFORM_STATUS_IDS[p]]
        )
    return SETUP_PAGE_SHELL.format(
        overlay_list=overlay_list_html(port),
        platform_cards=cards_html,
        port=port,
        credential_fields=credential_fields,
        status_refresh=status_refresh,
    )


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
        elif self.path.startswith("/poll-alerts/"):
            overlay_id = self.path[len("/poll-alerts/"):].split("/")[0]
            with STATE_LOCK:
                events = STATE["alert_queues"].get(overlay_id, [])
                STATE["alert_queues"][overlay_id] = []
            self._send_json(events)
        elif self.path == "/status":
            with STATE_LOCK:
                self._send_json({
                    "twitchStatus": STATE["twitch_status"],
                    "twitchError": STATE["twitch_error"],
                    "kickStatus": STATE["kick_status"],
                    "kickError": STATE["kick_error"],
                    "youtubeStatus": STATE["youtube_status"],
                    "youtubeError": STATE["youtube_error"],
                    "chaturbateStatus": STATE["chaturbate_status"],
                    "chaturbateError": STATE["chaturbate_error"],
                    "streamerbotStatus": STATE["streamerbot_status"],
                    "streamerbotError": STATE["streamerbot_error"],
                    "joystickStatus": STATE["joystick_status"],
                    "joystickError": STATE["joystick_error"],
                })
        elif self.path in ("/setup", "/"):
            creds = load_credentials()
            port = int(MANIFEST.get("port", 8420))
            self._send_html(setup_page_html(port, creds))
        elif self.path == "/joystick-connect":
            creds = load_credentials()
            client_id = creds.get("joystickClientId", "").strip()
            if not client_id:
                self._send_html("<h1>Save a Joystick.tv Client ID first, then try Connect again.</h1>", status=400)
                return
            state = base64.urlsafe_b64encode(os.urandom(18)).rstrip(b"=").decode()
            verifier = joystick_code_verifier()
            with STATE_LOCK:
                STATE["joystick_oauth_state"] = state
                STATE["joystick_oauth_verifier"] = verifier
            port = int(MANIFEST.get("port", 8420))
            redirect_uri = joystick_redirect_uri(port)
            challenge = joystick_code_challenge(verifier)
            authorize_url = "https://joystick.tv/oauth/authorize?" + urllib.parse.urlencode({
                "response_type": "code",
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "scope": "identity:read chat:read chat:write chat:moderate",
                "state": state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            })
            self.send_response(302)
            self.send_header("Location", authorize_url)
            self.end_headers()
        elif self.path.startswith(JOYSTICK_REDIRECT_PATH):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            code = (params.get("code") or [""])[0]
            state = (params.get("state") or [""])[0]
            with STATE_LOCK:
                expected_state = STATE["joystick_oauth_state"]
                verifier = STATE["joystick_oauth_verifier"]
            if not code or not state or state != expected_state:
                self._send_html("<h1>Joystick login didn't complete (missing/mismatched state) — try Connect again.</h1>", status=400)
                return
            try:
                port = int(MANIFEST.get("port", 8420))
                creds = load_credentials()
                client_id = creds.get("joystickClientId", "").strip()
                access_token, refresh_token = joystick_exchange_code(code, client_id, verifier, joystick_redirect_uri(port))
                username = joystick_fetch_identity(access_token) or "connected"
                creds["joystickAccessToken"] = access_token
                creds["joystickRefreshToken"] = refresh_token
                creds["joystickUsername"] = username
                save_credentials(creds)
                with STATE_LOCK:
                    STATE["joystick_oauth_state"] = None
                    STATE["joystick_oauth_verifier"] = None
                self.send_response(302)
                self.send_header("Location", "/setup")
                self.end_headers()
            except Exception as e:  # noqa: BLE001
                self._send_html(f"<h1>Joystick login failed: {e}</h1>", status=500)
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
            # Fired from the Twitch card specifically, so it only reaches
            # overlays that actually declare "twitch" — same scoping rule
            # as every real alert.
            with STATE_LOCK:
                push_alert("twitch", {"kind": "follow", "user": "TestViewer", "message": "just followed! (test)"})
            self._send_json({"ok": True})
        elif self.path == kick_webhook_path():
            # NOT SIGNATURE-VERIFIED. Kick signs webhook deliveries (per
            # docs.kick.com/events/webhook-security), but that verification
            # isn't implemented here yet — this was built without being able
            # to reach docs.kick.com to confirm the exact header names/
            # algorithm/public-key format, and guessing at crypto
            # verification is worse than clearly not doing it. Anyone who
            # learns the recipient's tunnel URL can currently POST a fake
            # event here. Revisit once those docs are reachable.
            event_type = self.headers.get("Kick-Event-Type") or payload.get("type") or payload.get("event")
            alert = kick_parse_webhook_event(event_type, payload)
            if alert:
                with STATE_LOCK:
                    push_alert("kick", alert)
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
    threading.Thread(target=chaturbate_loop, daemon=True).start()
    threading.Thread(target=streamerbot_loop, daemon=True).start()
    threading.Thread(target=joystick_loop, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"StreamerSuite standalone overlay helper running at http://127.0.0.1:{port}/setup")
    print("Open that URL to connect your accounts. Leave this window open while streaming.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
