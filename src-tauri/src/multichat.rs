use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::Duration;

const KEYRING_SERVICE: &str = "com.bearddoddity.multichat";
// Fixed so it only needs registering once per platform's OAuth app settings.
const OAUTH_PORT: u16 = 61823;
const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ── OBS/Meld overlay relay ──────────────────────────────────────────────
// The overlay is the SAME app (same index.html, embedded at compile time —
// always in sync, no separate copy to maintain), loaded with ?overlay=1 in
// an external browser source instead of the Tauri window. That external
// browser has no access to our OS-keyring OAuth tokens or the native
// Kick/Twitch bypass commands, so it can't reconnect to chat itself —
// instead it opens a local WebSocket and just renders whatever message
// JSON the real (already-connected, already-authenticated) desktop window
// relays to it. All the real work still happens in exactly one place.
const OVERLAY_PORT: u16 = 61826;
const OVERLAY_HTML: &str = include_str!("../../ui/index.html");

fn overlay_clients() -> &'static std::sync::Mutex<Vec<tungstenite::WebSocket<std::net::TcpStream>>> {
    static CLIENTS: std::sync::OnceLock<std::sync::Mutex<Vec<tungstenite::WebSocket<std::net::TcpStream>>>> = std::sync::OnceLock::new();
    CLIENTS.get_or_init(|| std::sync::Mutex::new(Vec::new()))
}

/// Broadcast one already-resolved chat message (as JSON, same shape the
/// desktop window's own addMessage() consumes) to every connected overlay
/// browser source. Never blocks the caller on a slow/dead client for long —
/// a failed send just drops that client from the list.
#[tauri::command]
pub(crate) fn overlay_broadcast(json: String) {
    let mut clients = overlay_clients().lock().unwrap();
    clients.retain_mut(|ws| ws.send(tungstenite::Message::text(json.clone())).is_ok());
}

// Each connection gets its own thread — a stalled/weird handshake (a
// browser source that connects but never finishes sending its request, for
// instance) must never block the accept loop from serving anyone else. This
// bit for real: an earlier single-threaded version let exactly that lock up
// the whole overlay server after one bad connection.
pub(crate) fn start_overlay_server() {
    std::thread::spawn(|| {
        let listener = match TcpListener::bind(("127.0.0.1", OVERLAY_PORT)) {
            Ok(l) => l,
            Err(_) => return, // port already in use (e.g. a second app instance) — overlay just won't be available
        };
        for mut stream in listener.incoming().flatten() {
            std::thread::spawn(move || {
                stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
                let mut peek_buf = [0u8; 512];
                let peeked = stream.peek(&mut peek_buf).unwrap_or(0);
                if peeked == 0 {
                    return; // no request ever arrived within the timeout — drop it, don't block anyone else
                }
                let is_ws_upgrade = String::from_utf8_lossy(&peek_buf[..peeked]).to_lowercase().contains("upgrade: websocket");
                if is_ws_upgrade {
                    stream.set_read_timeout(None).ok(); // a live WS connection should stay open indefinitely
                    if let Ok(ws) = tungstenite::accept(stream) {
                        overlay_clients().lock().unwrap().push(ws);
                    }
                } else {
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        OVERLAY_HTML.len(),
                        OVERLAY_HTML
                    );
                    // Dropping the stream right after write_all can reset the
                    // connection before the OS finishes flushing a payload this
                    // large — flush explicitly and half-close gracefully instead
                    // of an abrupt drop, or the browser gets a truncated body.
                    if stream.write_all(resp.as_bytes()).is_ok() {
                        let _ = stream.flush();
                        let _ = stream.shutdown(std::net::Shutdown::Write);
                    }
                }
            });
        }
    });
}

/// Resolve a Kick channel slug to its chatroom id.
/// Browsers can't call this endpoint (CORS + Cloudflare); native reqwest with
/// browser-ish headers gets through. Returns the numeric chatroom id.
#[tauri::command]
pub(crate) async fn resolve_kick_chatroom(slug: String) -> Result<u64, String> {
    let chan = fetch_kick_channel(&slug).await?;
    chan.pointer("/chatroom/id")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "no chatroom.id in response".into())
}

/// Kick's live chat payload carries no avatar field at all (confirmed against
/// real traffic) — but the same public channel-lookup endpoint returns
/// `user.profile_pic` for ANY username, not just the broadcaster's own.
#[tauri::command]
pub(crate) async fn resolve_kick_avatar(username: String) -> Result<Option<String>, String> {
    let chan = fetch_kick_channel(&username).await?;
    Ok(chan
        .pointer("/user/profile_pic")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

/// Resolve a Kick channel slug to the broadcaster's numeric user id, for
/// looking up 7TV emote sets. Prefers the official OAuth-authenticated API
/// (unaffected by the Cloudflare block on the unofficial endpoint); falls
/// back to the unofficial endpoint when Kick isn't connected.
#[tauri::command]
pub(crate) async fn kick_resolve_broadcaster_id(slug: String) -> Result<i64, String> {
    if let Some(access_token) = kr_get("kick.access_token") {
        let client = reqwest::Client::new();
        let resp = client
            .get("https://api.kick.com/public/v1/channels")
            .query(&[("slug", slug.as_str())])
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            if let Some(id) = body.pointer("/data/0/broadcaster_user_id").and_then(|v| v.as_i64()) {
                return Ok(id);
            }
        }
    }
    let chan = fetch_kick_channel(&slug).await?;
    chan.pointer("/user_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "no user_id in response".into())
}

/// Live status/viewer count/category for Stream Stats, via Kick's official
/// public API (`stream.is_live`, `stream.viewer_count`, `stream.start_time`,
/// `category.name`) — unlike the unofficial `kick.com/api/v2` endpoint this
/// doesn't need Cloudflare-bypass headers, but it does need a connected Kick
/// account (reuses Multi-Chat's own, same as chat/moderation already do).
/// Kick's public API has no follower-count field, so that's left out rather
/// than guessed at.
#[tauri::command]
pub(crate) async fn kick_channel_stats(slug: String) -> Result<Value, String> {
    let access_token = kr_get("kick.access_token").ok_or("Kick not connected — connect it in Multi-Chat first")?;

    async fn get(client: &reqwest::Client, slug: &str, access_token: &str) -> Result<reqwest::Response, String> {
        client
            .get("https://api.kick.com/public/v1/channels")
            .query(&[("slug", slug)])
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())
    }

    let client = reqwest::Client::new();
    let mut resp = get(&client, &slug, &access_token).await?;
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        let fresh = refresh_token("kick", "https://id.kick.com/oauth/token").await?;
        resp = get(&client, &slug, &fresh).await?;
    }
    if !resp.status().is_success() {
        return Err(format!("Kick returned {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let channel = body
        .pointer("/data/0")
        .ok_or_else(|| format!("couldn't find Kick channel \"{slug}\""))?;

    Ok(serde_json::json!({
        "is_live": channel.pointer("/stream/is_live").and_then(|v| v.as_bool()).unwrap_or(false),
        "viewer_count": channel.pointer("/stream/viewer_count"),
        "title": channel.get("stream_title"),
        "category_name": channel.pointer("/category/name"),
        "started_at": channel.pointer("/stream/start_time"),
    }))
}

/// The channel's custom per-tier subscriber badge images — only available
/// via the unofficial channel endpoint (Kick's official public API has no
/// equivalent). Returns [{months, url}], sorted by months descending so the
/// frontend can just find the first entry whose months <= the chatter's
/// subscribed months.
#[tauri::command]
pub(crate) async fn kick_resolve_sub_badges(slug: String) -> Result<Value, String> {
    let chan = fetch_kick_channel(&slug).await?;
    let mut tiers: Vec<Value> = chan
        .pointer("/subscriber_badges")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|b| {
            let months = b.get("months")?.as_i64()?;
            let url = b.pointer("/badge_image/src")?.as_str()?.to_string();
            Some(serde_json::json!({ "months": months, "url": url }))
        })
        .collect();
    tiers.sort_by(|a, b| b["months"].as_i64().cmp(&a["months"].as_i64()));
    Ok(Value::Array(tiers))
}

// One shared client for every kick.com/api/v2 call, reused for the life of
// the app instead of building a fresh one per request. Cookies stay in
// memory only (never written to disk) — but without reuse, every request
// looks like a brand-new, cookie-less first visit to Cloudflare even right
// after a prior request just earned clearance, which made the block far
// more likely to trigger than it needed to be.
fn kick_http_client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(BROWSER_UA)
            .cookie_store(true)
            .build()
            .expect("failed to build kick.com HTTP client")
    })
}

async fn fetch_kick_channel(slug: &str) -> Result<Value, String> {
    let url = format!(
        "https://kick.com/api/v2/channels/{}",
        urlencoding(&slug.to_lowercase())
    );
    let resp = kick_http_client()
        .get(&url)
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://kick.com/")
        .header("Sec-Fetch-Site", "same-origin")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Dest", "empty")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("kick.com returned {}", resp.status()));
    }
    resp.json().await.map_err(|e| e.to_string())
}

// ponytail: minimal percent-encoding, sufficient for slugs/tokens/URLs we build
fn urlencoding(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '~') {
                c.to_string()
            } else {
                format!("%{:02X}", c as u32)
            }
        })
        .collect()
}

fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

fn random_token(len: usize) -> String {
    use rand::Rng;
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::rng();
    (0..len)
        .map(|_| CHARS[rng.random_range(0..CHARS.len())] as char)
        .collect()
}

fn base64url(bytes: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    URL_SAFE_NO_PAD.encode(bytes)
}

// ── OAuth (Twitch, Kick) — native loopback callback, no external server ────

fn kr(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, account).map_err(|e| e.to_string())
}
fn kr_get(account: &str) -> Option<String> {
    kr(account).ok().and_then(|e| e.get_password().ok())
}
fn kr_set(account: &str, val: &str) -> Result<(), String> {
    kr(account)?.set_password(val).map_err(|e| e.to_string())
}
fn kr_delete(account: &str) {
    if let Ok(e) = kr(account) {
        let _ = e.delete_credential();
    }
}

#[derive(Serialize, Clone)]
pub struct OAuthAccount {
    platform: String,
    username: String,
    user_id: String,
}

const CLOSE_PAGE_OK: &str = "<html><body style='font-family:sans-serif;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Signed in — you can close this tab and return to Multi-Chat.</p></body></html>";
const CLOSE_PAGE_FAIL: &str = "<html><body style='font-family:sans-serif;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Login was cancelled or failed. You can close this tab.</p></body></html>";

/// Handle exactly one incoming HTTP request on `listener`: reply with a
/// friendly close page, and return the parsed code/state if it's the OAuth
/// redirect (None for stray requests like favicon.ico, so the caller loops).
fn handle_one_redirect(listener: &TcpListener) -> Result<Option<(String, String)>, String> {
    let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
    stream.set_read_timeout(Some(Duration::from_secs(10))).ok();
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() || line.is_empty() {
        return Ok(None);
    }
    let path = line.split_whitespace().nth(1).unwrap_or("").to_string();
    if !path.starts_with("/callback") {
        let resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(resp.as_bytes());
        return Ok(None);
    }
    let has_code = path.contains("code=");
    let body = if has_code { CLOSE_PAGE_OK } else { CLOSE_PAGE_FAIL };
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(resp.as_bytes());
    if !has_code {
        return Err("login was cancelled".into());
    }
    let query = path.splitn(2, '?').nth(1).unwrap_or("");
    let mut code = None;
    let mut state = None;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        let k = kv.next().unwrap_or("");
        let v = urldecode(kv.next().unwrap_or(""));
        match k {
            "code" => code = Some(v),
            "state" => state = Some(v),
            _ => {}
        }
    }
    let state = state.ok_or("missing state in redirect")?;
    let code = code.ok_or("no authorization code in redirect")?;
    Ok(Some((code, state)))
}

/// Block waiting for exactly one OAuth redirect to `http://localhost:<port>/callback`,
/// verify `state`, and return the authorization code.
///
/// Twitch and Kick's dashboards both require the literal host `localhost` for
/// local redirect URIs (no raw IP, no HTTPS requirement) — but on Windows
/// "localhost" can resolve to the IPv6 loopback `::1` before `127.0.0.1`, so a
/// single v4-only listener can silently miss the browser's request. Bind both
/// families and race them; whichever gets the real redirect wins.
fn await_oauth_redirect(expected_state: &str) -> Result<String, String> {
    let v4 = TcpListener::bind(("127.0.0.1", OAUTH_PORT));
    let v6 = TcpListener::bind(("::1", OAUTH_PORT));
    if v4.is_err() && v6.is_err() {
        return Err(format!(
            "couldn't open local port {OAUTH_PORT} for the OAuth callback: {}",
            v4.err().unwrap()
        ));
    }

    let (tx, rx) = std::sync::mpsc::channel::<Result<String, String>>();
    for listener in [v4.ok(), v6.ok()].into_iter().flatten() {
        let tx = tx.clone();
        let expected_state = expected_state.to_string();
        std::thread::spawn(move || loop {
            match handle_one_redirect(&listener) {
                Ok(Some((code, state))) => {
                    let result = if state == expected_state {
                        Ok(code)
                    } else {
                        Err("state mismatch — stale or replayed login, please try again".into())
                    };
                    let _ = tx.send(result);
                    return;
                }
                Ok(None) => continue, // stray request (favicon, etc.) — keep listening
                Err(e) => {
                    let _ = tx.send(Err(e));
                    return;
                }
            }
        });
    }
    drop(tx); // let recv_timeout return once both threads have exited without a result

    rx.recv_timeout(Duration::from_secs(180))
        .map_err(|_| "timed out waiting for browser login (3 min)".to_string())?
}

#[tauri::command]
pub(crate) async fn oauth_login(
    app: tauri::AppHandle,
    platform: String,
    client_id: String,
    client_secret: String,
) -> Result<OAuthAccount, String> {
    if !["twitch", "kick", "joystick"].contains(&platform.as_str()) {
        return Err("OAuth login is only available for Twitch, Kick and Joystick.tv".into());
    }
    // Blank fields mean "reuse what's already saved" — the UI pre-fills the
    // Client ID but never re-displays a saved secret, so a login retry after
    // app restart shouldn't require retyping either one.
    let client_id = if client_id.is_empty() {
        kr_get(&format!("{platform}.client_id")).unwrap_or_default()
    } else {
        client_id
    };
    let client_secret = if client_secret.is_empty() {
        kr_get(&format!("{platform}.client_secret")).unwrap_or_default()
    } else {
        client_secret
    };
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("enter the Client ID and Client Secret first".into());
    }
    kr_set(&format!("{platform}.client_id"), &client_id)?;
    kr_set(&format!("{platform}.client_secret"), &client_secret)?;

    let state = random_token(24);
    let verifier = random_token(64);
    // Twitch/Kick both require the literal host "localhost" for local redirect
    // URIs — a raw IP like 127.0.0.1 is rejected at app-registration time.
    // Joystick ignores redirect_uri in the request (it's fixed on the bot's
    // dashboard config, which we told the user to set to this same URL).
    let redirect_uri = format!("http://localhost:{OAUTH_PORT}/callback");

    let authorize_url = if platform == "joystick" {
        // No redirect_uri param — Joystick reads it from the bot's own config.
        // The old `scope=bot` grants everything and still works, but
        // Joystick's docs now ask new integrations to request explicit
        // scopes — chat:moderate is the one that unlocks delete/timeout/ban.
        format!(
            "https://joystick.tv/api/oauth/authorize?response_type=code&client_id={}&scope={}&state={}",
            urlencoding(&client_id),
            urlencoding("identity:read chat:read chat:write chat:moderate"),
            state
        )
    } else if platform == "twitch" {
        format!(
            "https://id.twitch.tv/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}",
            urlencoding(&client_id),
            urlencoding(&redirect_uri),
            // user:read:chat is required for EventSub's channel.chat.message /
            // channel.chat.notification (API-based chat read); user:write:chat
            // is the separate scope Helix's send-message endpoint needs — chat:edit
            // alone (the old IRC-era scope) doesn't cover it and 401s regardless
            // of how many times the token gets refreshed.
            urlencoding("chat:edit chat:read user:read:email user:read:chat user:write:chat moderator:manage:chat_messages moderator:manage:banned_users"),
            state
        )
    } else {
        let challenge = base64url(&Sha256::digest(verifier.as_bytes()));
        format!(
            "https://id.kick.com/oauth/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            urlencoding(&client_id),
            urlencoding(&redirect_uri),
            urlencoding("user:read channel:read chat:write moderation:ban moderation:chat_message:manage"),
            state,
            challenge
        )
    };

    // tauri-plugin-shell's open() is deprecated in favor of tauri-plugin-opener,
    // but it's the proven pattern already used elsewhere in this codebase (StatusForge).
    #[allow(deprecated)]
    {
        use tauri_plugin_shell::ShellExt;
        app.shell()
            .open(&authorize_url, None)
            .map_err(|e| format!("couldn't open browser: {e}"))?;
    }

    let state_for_thread = state.clone();
    let code = tauri::async_runtime::spawn_blocking(move || await_oauth_redirect(&state_for_thread))
        .await
        .map_err(|e| e.to_string())??;

    let client = reqwest::Client::new();
    let account = if platform == "joystick" {
        // Joystick's token endpoint takes params in the query string (not the
        // body) and authenticates with HTTP Basic (client_id:client_secret),
        // not a secret parameter. No user-profile endpoint exists, so the
        // "username" is just whatever the caller already knows/typed.
        let resp: Value = client
            .post("https://api.joystick.tv/api/oauth/token")
            .query(&[
                ("redirect_uri", "unused"),
                ("code", code.as_str()),
                ("grant_type", "authorization_code"),
            ])
            .basic_auth(&client_id, Some(&client_secret))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let access_token = resp
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or("Joystick didn't return an access token — check the client ID/secret")?
            .to_string();
        let refresh_token = resp
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        kr_set("joystick.access_token", &access_token)?;
        kr_set("joystick.refresh_token", &refresh_token)?;
        kr_set("joystick.username", "installed")?;
        OAuthAccount { platform: "joystick".into(), username: "installed".into(), user_id: String::new() }
    } else if platform == "twitch" {
        let resp: Value = client
            .post("https://id.twitch.tv/oauth2/token")
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("code", code.as_str()),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri.as_str()),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let access_token = resp
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or("Twitch didn't return an access token — check the client ID/secret")?
            .to_string();
        let refresh_token = resp
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let me: Value = client
            .get("https://api.twitch.tv/helix/users")
            .bearer_auth(&access_token)
            .header("Client-Id", &client_id)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let user = me
            .pointer("/data/0")
            .ok_or("couldn't read the Twitch account after login")?;
        let username = user
            .get("display_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let user_id = user
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        kr_set("twitch.access_token", &access_token)?;
        kr_set("twitch.refresh_token", &refresh_token)?;
        kr_set("twitch.username", &username)?;
        kr_set("twitch.user_id", &user_id)?;
        OAuthAccount { platform: "twitch".into(), username, user_id }
    } else {
        let resp: Value = client
            .post("https://id.kick.com/oauth/token")
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("code", code.as_str()),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri.as_str()),
                ("code_verifier", verifier.as_str()),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let access_token = resp
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or("Kick didn't return an access token — check the client ID/secret")?
            .to_string();
        let refresh_token = resp
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let me: Value = client
            .get("https://api.kick.com/public/v1/users")
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let user = me
            .pointer("/data/0")
            .ok_or("couldn't read the Kick account after login")?;
        let username = user
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let user_id = user
            .get("user_id")
            .and_then(|v| v.as_u64())
            .map(|n| n.to_string())
            .unwrap_or_default();
        kr_set("kick.access_token", &access_token)?;
        kr_set("kick.refresh_token", &refresh_token)?;
        kr_set("kick.username", &username)?;
        kr_set("kick.user_id", &user_id)?;
        OAuthAccount { platform: "kick".into(), username, user_id }
    };
    Ok(account)
}

#[tauri::command]
pub(crate) fn oauth_get_account(platform: String) -> Option<OAuthAccount> {
    let username = kr_get(&format!("{platform}.username"))?;
    if username.is_empty() {
        return None;
    }
    // A stale/partial keyring write can leave username behind without the
    // token needed to actually call the API — don't report "connected" if
    // that's the case, or every subsequent call fails with a confusing error.
    kr_get(&format!("{platform}.access_token"))?;
    let user_id = kr_get(&format!("{platform}.user_id")).unwrap_or_default();
    Some(OAuthAccount { platform, username, user_id })
}

#[tauri::command]
pub(crate) fn oauth_logout(platform: String) {
    // Disconnect means a clean slate — erase the saved app credentials too,
    // not just the session token, so nothing lingers after the user asks to
    // remove a connection.
    for suffix in ["access_token", "refresh_token", "username", "user_id", "client_id", "client_secret"] {
        kr_delete(&format!("{platform}.{suffix}"));
    }
}

/// Wipes every credential this app has ever written to the OS keyring —
/// Windows Credential Manager isn't touched by a normal uninstall, so
/// without this, Client IDs/Secrets and tokens for every platform silently
/// survive an uninstall/reinstall. Called both from the in-app "Reset
/// everything" button (via the tauri::command wrapper below) and from the
/// NSIS uninstaller (see `--clear-credentials` in main.rs, which calls this
/// plain function directly — no Tauri app instance exists at that point).
pub fn wipe_all_credentials() {
    for platform in ["twitch", "kick", "joystick"] {
        oauth_logout(platform.to_string());
    }
    kr_delete("streamerbot.password");
}

#[tauri::command]
pub(crate) fn wipe_all_credentials_cmd() {
    wipe_all_credentials();
}

/// The Client ID isn't secret — safe to read back and pre-fill the form so a
/// saved login doesn't need retyping after an app restart.
#[tauri::command]
pub(crate) fn oauth_get_client_id(platform: String) -> Option<String> {
    kr_get(&format!("{platform}.client_id")).filter(|s| !s.is_empty())
}

/// Existence check only — never sends the secret value back to the frontend.
#[tauri::command]
pub(crate) fn oauth_has_client_secret(platform: String) -> bool {
    kr_get(&format!("{platform}.client_secret")).is_some_and(|s| !s.is_empty())
}

/// Joystick-only: unlike Twitch/Kick (where the secret is only ever used
/// Rust-side, for a token exchange), Joystick's gateway auth is a Base64
/// basic key the frontend must build itself to open its own WebSocket — so
/// the raw secret has to come back to JS here. Still strictly better than
/// the old plaintext-in-localStorage storage it replaces.
#[tauri::command]
pub(crate) fn oauth_get_client_secret(platform: String) -> Option<String> {
    kr_get(&format!("{platform}.client_secret")).filter(|s| !s.is_empty())
}

/// Streamer.bot's WebSocket password (same idea as Joystick's secret above):
/// the SHA256 auth handshake and the SendMessage request both happen over a
/// plain browser WebSocket the frontend opens itself, so the raw password
/// has to come back to JS — there's no Rust-side call it could stay behind.
#[tauri::command]
pub(crate) fn streamerbot_save_password(password: String) -> Result<(), String> {
    kr_set("streamerbot.password", &password)
}
#[tauri::command]
pub(crate) fn streamerbot_has_password() -> bool {
    kr_get("streamerbot.password").is_some_and(|s| !s.is_empty())
}
#[tauri::command]
pub(crate) fn streamerbot_get_password() -> Option<String> {
    kr_get("streamerbot.password").filter(|s| !s.is_empty())
}
#[tauri::command]
pub(crate) fn streamerbot_clear_password() {
    kr_delete("streamerbot.password");
}

/// Twitch/Kick access tokens expire after a few hours; the refresh_token
/// doesn't. Exchanging it silently — instead of forcing a full browser
/// re-login — is what makes "connect once" actually mean once.
async fn refresh_token(platform: &str, token_url: &str) -> Result<String, String> {
    let client_id = kr_get(&format!("{platform}.client_id"))
        .ok_or_else(|| format!("not connected to {platform} — connect your account first"))?;
    let client_secret = kr_get(&format!("{platform}.client_secret"))
        .ok_or_else(|| format!("not connected to {platform} — connect your account first"))?;
    let refresh_token = kr_get(&format!("{platform}.refresh_token"))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("your saved {platform} login has expired — reconnect your account"))?;
    let client = reqwest::Client::new();
    let resp: Value = client
        .post(token_url)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let access_token = resp
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("{platform} refresh failed — reconnect your account"))?
        .to_string();
    let new_refresh = resp
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or(refresh_token.as_str())
        .to_string();
    kr_set(&format!("{platform}.access_token"), &access_token)?;
    kr_set(&format!("{platform}.refresh_token"), &new_refresh)?;
    Ok(access_token)
}

#[tauri::command]
pub(crate) async fn send_twitch_message(channel_login: String, text: String) -> Result<(), String> {
    let mut access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let sender_id = kr_get("twitch.user_id").ok_or("not connected to Twitch")?;
    let client = reqwest::Client::new();

    for attempt in 0..2 {
        let target_resp = client
            .get("https://api.twitch.tv/helix/users")
            .query(&[("login", channel_login.to_lowercase())])
            .bearer_auth(&access_token)
            .header("Client-Id", &client_id)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if target_resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
            continue;
        }
        let target: Value = target_resp.json().await.map_err(|e| e.to_string())?;
        let broadcaster_id = target
            .pointer("/data/0/id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| format!("couldn't find Twitch channel \"{channel_login}\""))?
            .to_string();

        let send_resp = client
            .post("https://api.twitch.tv/helix/chat/messages")
            .bearer_auth(&access_token)
            .header("Client-Id", &client_id)
            .json(&serde_json::json!({
                "broadcaster_id": broadcaster_id,
                "sender_id": sender_id,
                "message": text,
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if send_resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
            continue;
        }
        if !send_resp.status().is_success() {
            return Err(format!("Twitch send failed: {}", send_resp.status()));
        }
        return Ok(());
    }
    Err("Twitch send failed even after refreshing the token — reconnect your account".into())
}

#[tauri::command]
pub(crate) async fn send_kick_message(channel_slug: String, text: String) -> Result<(), String> {
    let mut access_token = kr_get("kick.access_token").ok_or("not connected to Kick")?;
    // Official OAuth-authenticated lookup (falls back to the unofficial,
    // Cloudflare-prone endpoint only if that fails) — sending a message
    // shouldn't depend on the same endpoint that's been getting blocked.
    let broadcaster_user_id = kick_resolve_broadcaster_id(channel_slug.clone()).await?;
    let client = reqwest::Client::new();

    for attempt in 0..2 {
        let resp = client
            .post("https://api.kick.com/public/v1/chat")
            .bearer_auth(&access_token)
            .json(&serde_json::json!({
                "content": text,
                "type": "user",
                "broadcaster_user_id": broadcaster_user_id,
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("kick", "https://id.kick.com/oauth/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Kick send failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Kick send failed even after refreshing the token — reconnect your account".into())
}

/// Requires moderator:manage:chat_messages — the connected account must be
/// the broadcaster or a mod in that channel, same as Twitch's own UI.
#[tauri::command]
pub(crate) async fn twitch_delete_message(broadcaster_id: String, message_id: String) -> Result<(), String> {
    let mut access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let moderator_id = kr_get("twitch.user_id").ok_or("not connected to Twitch")?;
    let client = reqwest::Client::new();
    for attempt in 0..2 {
        let resp = client
            .delete("https://api.twitch.tv/helix/moderation/chat")
            .query(&[
                ("broadcaster_id", broadcaster_id.as_str()),
                ("moderator_id", moderator_id.as_str()),
                ("message_id", message_id.as_str()),
            ])
            .bearer_auth(&access_token)
            .header("Client-Id", &client_id)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Twitch delete message failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Twitch delete message failed even after refreshing the token — reconnect your account".into())
}

/// Requires moderator:manage:banned_users. duration_secs: None bans
/// indefinitely; Some(n) times the user out for n seconds (Twitch's own unit).
#[tauri::command]
pub(crate) async fn twitch_moderate_user(
    broadcaster_id: String,
    user_id: String,
    duration_secs: Option<u32>,
    reason: Option<String>,
) -> Result<(), String> {
    let mut access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let moderator_id = kr_get("twitch.user_id").ok_or("not connected to Twitch")?;
    let client = reqwest::Client::new();
    let mut data = serde_json::Map::new();
    data.insert("user_id".into(), Value::String(user_id));
    if let Some(d) = duration_secs {
        data.insert("duration".into(), Value::from(d));
    }
    if let Some(r) = reason {
        data.insert("reason".into(), Value::String(r));
    }
    let body = serde_json::json!({ "data": data });

    for attempt in 0..2 {
        let resp = client
            .post("https://api.twitch.tv/helix/moderation/bans")
            .query(&[
                ("broadcaster_id", broadcaster_id.as_str()),
                ("moderator_id", moderator_id.as_str()),
            ])
            .bearer_auth(&access_token)
            .header("Client-Id", &client_id)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Twitch moderate user failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Twitch moderate user failed even after refreshing the token — reconnect your account".into())
}

/// Requires moderation:chat_message:manage.
#[tauri::command]
pub(crate) async fn kick_delete_message(message_id: String) -> Result<(), String> {
    let mut access_token = kr_get("kick.access_token").ok_or("not connected to Kick")?;
    let client = reqwest::Client::new();
    for attempt in 0..2 {
        let resp = client
            .delete(format!("https://api.kick.com/public/v1/chat/{message_id}"))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("kick", "https://id.kick.com/oauth/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Kick delete message failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Kick delete message failed even after refreshing the token — reconnect your account".into())
}

/// Requires moderation:ban. duration_minutes: None bans indefinitely;
/// Some(n) times the user out for n minutes (Kick's own unit, max 10080).
#[tauri::command]
pub(crate) async fn kick_moderate_user(
    broadcaster_user_id: i64,
    user_id: i64,
    duration_minutes: Option<i64>,
    reason: Option<String>,
) -> Result<(), String> {
    let mut access_token = kr_get("kick.access_token").ok_or("not connected to Kick")?;
    let client = reqwest::Client::new();
    let mut body = serde_json::Map::new();
    body.insert("broadcaster_user_id".into(), Value::from(broadcaster_user_id));
    body.insert("user_id".into(), Value::from(user_id));
    if let Some(d) = duration_minutes {
        body.insert("duration".into(), Value::from(d));
    }
    if let Some(r) = reason {
        body.insert("reason".into(), Value::String(r));
    }

    for attempt in 0..2 {
        let resp = client
            .post("https://api.kick.com/public/v1/moderation/bans")
            .bearer_auth(&access_token)
            .json(&Value::Object(body.clone()))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("kick", "https://id.kick.com/oauth/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Kick moderate user failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Kick moderate user failed even after refreshing the token — reconnect your account".into())
}

/// Requires chat:moderate. Joystick's REST moderation endpoints (documented
/// at support.joystick.tv/developer_support/) are new — the WS gateway used
/// for reading/sending chat has no moderation actions of its own, so this is
/// the first moderation support Joystick has had in this app at all.
#[tauri::command]
pub(crate) async fn joystick_delete_message(message_id: String) -> Result<(), String> {
    let mut access_token = kr_get("joystick.access_token").ok_or("not connected to Joystick.tv")?;
    let client = reqwest::Client::new();
    for attempt in 0..2 {
        let resp = client
            .delete(format!("https://api.joystick.tv/api/v1/chat/messages/{message_id}"))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("joystick", "https://api.joystick.tv/api/oauth/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Joystick delete message failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Joystick delete message failed even after refreshing the token — reconnect your account".into())
}

/// Requires chat:moderate. `ban` picks which endpoint: true bans the message
/// author permanently, false times them out — Joystick's mute endpoint takes
/// no duration parameter (unlike Twitch/Kick), so "Timeout" here is whatever
/// default length Joystick's own gateway applies.
#[tauri::command]
pub(crate) async fn joystick_moderate_user(message_id: String, ban: bool) -> Result<(), String> {
    let mut access_token = kr_get("joystick.access_token").ok_or("not connected to Joystick.tv")?;
    let client = reqwest::Client::new();
    let action = if ban { "ban" } else { "mute" };
    for attempt in 0..2 {
        let resp = client
            .post(format!("https://api.joystick.tv/api/v1/chat/messages/{message_id}/{action}"))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("joystick", "https://api.joystick.tv/api/oauth/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Joystick moderate user failed: {}", resp.status()));
        }
        return Ok(());
    }
    Err("Joystick moderate user failed even after refreshing the token — reconnect your account".into())
}

/// Manual, per-message translation — unofficial Google Translate endpoint
/// (free, no key, no signup). No OAuth involved; this is just a public GET.
#[tauri::command]
pub(crate) async fn translate_text(text: String, target: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://translate.googleapis.com/translate_a/single")
        .query(&[
            ("client", "gtx"),
            ("sl", "auto"),
            ("tl", target.as_str()),
            ("dt", "t"),
            ("q", text.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Translation failed: {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let segments = body
        .pointer("/0")
        .and_then(|v| v.as_array())
        .ok_or("unexpected translation response shape")?;
    let mut out = String::new();
    for seg in segments {
        if let Some(s) = seg.get(0).and_then(|v| v.as_str()) {
            out.push_str(s);
        }
    }
    if out.is_empty() {
        return Err("empty translation result".into());
    }
    Ok(out)
}

/// Create one Twitch EventSub subscription delivered over an already-open
/// WebSocket session. Used for both channel.chat.message and
/// channel.chat.notification — both take the same {broadcaster_user_id,
/// user_id} condition shape.
#[tauri::command]
pub(crate) async fn twitch_eventsub_subscribe(
    session_id: String,
    channel_login: String,
    sub_type: String,
) -> Result<Value, String> {
    let access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let user_id = kr_get("twitch.user_id").ok_or("not connected to Twitch")?;

    async fn subscribe_once(
        client: &reqwest::Client,
        access_token: &str,
        client_id: &str,
        session_id: &str,
        broadcaster_user_id: &str,
        user_id: &str,
        sub_type: &str,
    ) -> Result<reqwest::Response, String> {
        client
            .post("https://api.twitch.tv/helix/eventsub/subscriptions")
            .bearer_auth(access_token)
            .header("Client-Id", client_id)
            .json(&serde_json::json!({
                "type": sub_type,
                "version": "1",
                "condition": { "broadcaster_user_id": broadcaster_user_id, "user_id": user_id },
                "transport": { "method": "websocket", "session_id": session_id },
            }))
            .send()
            .await
            .map_err(|e| e.to_string())
    }

    let client = reqwest::Client::new();
    let target: Value = client
        .get("https://api.twitch.tv/helix/users")
        .query(&[("login", channel_login.to_lowercase())])
        .bearer_auth(&access_token)
        .header("Client-Id", &client_id)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let broadcaster_user_id = target
        .pointer("/data/0/id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("couldn't find Twitch channel \"{channel_login}\""))?
        .to_string();

    let mut resp = subscribe_once(&client, &access_token, &client_id, &session_id, &broadcaster_user_id, &user_id, &sub_type).await?;
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        let fresh = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
        resp = subscribe_once(&client, &fresh, &client_id, &session_id, &broadcaster_user_id, &user_id, &sub_type).await?;
    }
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("EventSub subscribe ({sub_type}) failed: {status} {body}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

/// Batch-resolve real Twitch profile pictures via Helix (up to 100 ids per
/// call). Only usable once an account is connected — Helix has no anonymous
/// access, so anonymous IRC viewers keep using the unavatar.io fallback.
/// Returns a map of user_id -> profile_image_url for whichever ids were found.
#[tauri::command]
pub(crate) async fn twitch_resolve_avatars(user_ids: Vec<String>) -> Result<Value, String> {
    let mut access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let client = reqwest::Client::new();
    let mut out = serde_json::Map::new();

    for chunk in user_ids.chunks(100) {
        let query: Vec<(&str, &str)> = chunk.iter().map(|id| ("id", id.as_str())).collect();
        let body: Value = 'retry: loop {
            for attempt in 0..2 {
                let resp = client
                    .get("https://api.twitch.tv/helix/users")
                    .query(&query)
                    .bearer_auth(&access_token)
                    .header("Client-Id", &client_id)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
                    access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
                    continue;
                }
                if !resp.status().is_success() {
                    return Err(format!("Twitch avatar lookup failed: {}", resp.status()));
                }
                break 'retry resp.json().await.map_err(|e| e.to_string())?;
            }
            return Err("Twitch avatar lookup failed even after refreshing the token — reconnect your account".into());
        };
        for user in body.get("data").and_then(|v| v.as_array()).into_iter().flatten() {
            if let (Some(id), Some(url)) = (
                user.get("id").and_then(|v| v.as_str()),
                user.get("profile_image_url").and_then(|v| v.as_str()),
            ) {
                out.insert(id.to_string(), Value::String(url.to_string()));
            }
        }
    }
    Ok(Value::Object(out))
}

/// The channel's custom chat badges (sub tiers, bits tiers, etc.) merged
/// with Twitch's global set — channel-specific wins on a set_id clash, same
/// precedence Twitch's own chat client uses. Returns a flat map keyed
/// "set_id/version_id" (matching the IRC/EventSub badge tag format exactly)
/// so the frontend can look a chatter's badge straight up with no reshaping.
#[tauri::command]
pub(crate) async fn twitch_resolve_badges(broadcaster_id: String) -> Result<Value, String> {
    let mut access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let client = reqwest::Client::new();
    let mut out = serde_json::Map::new();

    for url in [
        "https://api.twitch.tv/helix/chat/badges/global".to_string(),
        format!("https://api.twitch.tv/helix/chat/badges?broadcaster_id={broadcaster_id}"),
    ] {
        let body: Value = 'retry: loop {
            for attempt in 0..2 {
                let resp = client
                    .get(&url)
                    .bearer_auth(&access_token)
                    .header("Client-Id", &client_id)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
                    access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
                    continue;
                }
                if !resp.status().is_success() {
                    return Err(format!("Twitch badge lookup failed: {}", resp.status()));
                }
                break 'retry resp.json().await.map_err(|e| e.to_string())?;
            }
            return Err("Twitch badge lookup failed even after refreshing the token — reconnect your account".into());
        };
        for set in body.get("data").and_then(|v| v.as_array()).into_iter().flatten() {
            let Some(set_id) = set.get("set_id").and_then(|v| v.as_str()) else { continue };
            for version in set.get("versions").and_then(|v| v.as_array()).into_iter().flatten() {
                if let (Some(version_id), Some(url)) = (
                    version.get("id").and_then(|v| v.as_str()),
                    version.get("image_url_2x").and_then(|v| v.as_str()),
                ) {
                    out.insert(format!("{set_id}/{version_id}"), Value::String(url.to_string())); // global pass first, channel pass overwrites on clash
                }
            }
        }
    }
    Ok(Value::Object(out))
}

/// Resolve a Twitch clip slug to its thumbnail + title (Helix, OAuth-only —
/// embed permission is gated client-side; this just powers the thumbnail
/// preview for clip links posted by permitted chatters).
#[tauri::command]
pub(crate) async fn twitch_resolve_clip(slug: String) -> Result<Value, String> {
    let mut access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let client = reqwest::Client::new();
    for attempt in 0..2 {
        let resp = client
            .get("https://api.twitch.tv/helix/clips")
            .query(&[("id", slug.as_str())])
            .bearer_auth(&access_token)
            .header("Client-Id", &client_id)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            access_token = refresh_token("twitch", "https://id.twitch.tv/oauth2/token").await?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("Twitch clip lookup failed: {}", resp.status()));
        }
        let body: Value = resp.json().await.map_err(|e| e.to_string())?;
        return body.pointer("/data/0").cloned().ok_or_else(|| "clip not found".into());
    }
    Err("Twitch clip lookup failed even after refreshing the token — reconnect your account".into())
}

/// Batch-resolve real Kick profile pictures via the official public API
/// (requires Kick OAuth — bypasses the Cloudflare-protected unofficial
/// kick.com/api/v2/channels endpoint entirely). Returns user_id -> profile_picture.
#[tauri::command]
pub(crate) async fn kick_resolve_avatars(user_ids: Vec<i64>) -> Result<Value, String> {
    let mut access_token = kr_get("kick.access_token").ok_or("not connected to Kick")?;
    let client = reqwest::Client::new();
    let mut out = serde_json::Map::new();

    for chunk in user_ids.chunks(50) {
        let query: Vec<(&str, String)> = chunk.iter().map(|id| ("id", id.to_string())).collect();
        let body: Value = 'retry: loop {
            for attempt in 0..2 {
                let resp = client
                    .get("https://api.kick.com/public/v1/users")
                    .query(&query)
                    .bearer_auth(&access_token)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if resp.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
                    access_token = refresh_token("kick", "https://id.kick.com/oauth/token").await?;
                    continue;
                }
                if !resp.status().is_success() {
                    return Err(format!("Kick avatar lookup failed: {}", resp.status()));
                }
                break 'retry resp.json().await.map_err(|e| e.to_string())?;
            }
            return Err("Kick avatar lookup failed even after refreshing the token — reconnect your account".into());
        };
        for user in body.get("data").and_then(|v| v.as_array()).into_iter().flatten() {
            if let (Some(id), Some(url)) = (
                user.get("user_id").and_then(|v| v.as_i64()),
                user.get("profile_picture").and_then(|v| v.as_str()),
            ) {
                out.insert(id.to_string(), Value::String(url.to_string()));
            }
        }
    }
    Ok(Value::Object(out))
}

// Entry point merged into the crate root's `run()` in lib.rs — see the
// `.plugin(tauri_plugin_shell::init())` (already registered by StatusForge's
// setup), the `start_overlay_server()` call folded into the shared
// `.setup()` closure, and the `multichat::`-qualified commands appended to
// the shared `generate_handler!` list.
