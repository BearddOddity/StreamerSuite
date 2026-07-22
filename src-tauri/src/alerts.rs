// Alerts Hub — real Twitch follow/sub/raid/cheer alerts via EventSub over
// WebSocket. Deliberately its own OAuth connection (own keyring service, own
// loopback port) rather than reusing StatusForge's or Multi-Chat's Twitch
// tokens: those were authorized with different scopes (category-push only,
// and chat-only respectively) that don't cover
// moderator:read:followers/channel:read:subscriptions/bits:read, so a third,
// narrowly-scoped connection is the honest option until the app has a
// shared credential model (see the settings-centralization discussion).
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::Duration;

const KEYRING_SERVICE: &str = "com.streamersuite.alerts";
const OAUTH_PORT: u16 = 61840;
const TWITCH_SCOPES: &str =
    "moderator:read:followers channel:read:subscriptions bits:read channel:read:hype_train";

const CLOSE_PAGE_OK: &str = "<html><body style='font-family:sans-serif;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Signed in — you can close this tab and return to StreamerSuite.</p></body></html>";
const CLOSE_PAGE_FAIL: &str = "<html><body style='font-family:sans-serif;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Login was cancelled or failed. You can close this tab.</p></body></html>";

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

/// Same dual-family-bind-and-race approach as StatusForge/Multi-Chat's OAuth
/// loopback servers — see multichat.rs's `await_oauth_redirect` doc comment.
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
                Ok(None) => continue,
                Err(e) => {
                    let _ = tx.send(Err(e));
                    return;
                }
            }
        });
    }
    drop(tx);

    rx.recv_timeout(Duration::from_secs(180))
        .map_err(|_| "timed out waiting for browser login (3 min)".to_string())?
}

#[derive(Serialize, Clone)]
pub struct AlertsOAuthAccount {
    username: String,
    user_id: String,
}

#[tauri::command]
pub(crate) async fn alerts_oauth_login(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<AlertsOAuthAccount, String> {
    let client_id = if client_id.is_empty() {
        kr_get("twitch.client_id").unwrap_or_default()
    } else {
        client_id
    };
    let client_secret = if client_secret.is_empty() {
        kr_get("twitch.client_secret").unwrap_or_default()
    } else {
        client_secret
    };
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("enter the Client ID and Client Secret first".into());
    }
    kr_set("twitch.client_id", &client_id)?;
    kr_set("twitch.client_secret", &client_secret)?;

    let state = random_token(24);
    let redirect_uri = format!("http://localhost:{OAUTH_PORT}/callback");
    let authorize_url = format!(
        "https://id.twitch.tv/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}",
        urlencoding(&client_id),
        urlencoding(&redirect_uri),
        urlencoding(TWITCH_SCOPES),
        state
    );

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
    let username = user.get("display_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();

    kr_set("twitch.access_token", &access_token)?;
    kr_set("twitch.refresh_token", &refresh_token)?;
    kr_set("twitch.username", &username)?;
    kr_set("twitch.user_id", &user_id)?;

    Ok(AlertsOAuthAccount { username, user_id })
}

#[tauri::command]
pub(crate) fn alerts_oauth_get_account() -> Option<AlertsOAuthAccount> {
    let username = kr_get("twitch.username")?;
    if username.is_empty() {
        return None;
    }
    Some(AlertsOAuthAccount {
        username,
        user_id: kr_get("twitch.user_id").unwrap_or_default(),
    })
}

#[tauri::command]
pub(crate) fn alerts_oauth_logout() {
    for suffix in ["access_token", "refresh_token", "username", "user_id", "client_id", "client_secret"] {
        kr_delete(&format!("twitch.{suffix}"));
    }
}

#[tauri::command]
pub(crate) fn alerts_oauth_get_client_id() -> Option<String> {
    kr_get("twitch.client_id").filter(|s| !s.is_empty())
}

#[tauri::command]
pub(crate) fn alerts_oauth_has_client_secret() -> bool {
    kr_get("twitch.client_secret").is_some_and(|s| !s.is_empty())
}

async fn refresh_access_token() -> Result<String, String> {
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;
    let client_secret = kr_get("twitch.client_secret").ok_or("not connected to Twitch")?;
    let refresh_token = kr_get("twitch.refresh_token").ok_or("not connected to Twitch")?;
    if client_id.is_empty() || client_secret.is_empty() || refresh_token.is_empty() {
        return Err("not connected to Twitch".into());
    }
    let resp: Value = reqwest::Client::new()
        .post("https://id.twitch.tv/oauth2/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
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
        .ok_or("Twitch refresh failed — reconnect your account")?
        .to_string();
    if let Some(new_refresh) = resp.get("refresh_token").and_then(|v| v.as_str()) {
        kr_set("twitch.refresh_token", new_refresh)?;
    }
    kr_set("twitch.access_token", &access_token)?;
    Ok(access_token)
}

/// Subscribe an already-open EventSub WebSocket session to one alert type.
/// Unlike Multi-Chat's chat-focused `twitch_eventsub_subscribe`, alert types
/// need different condition shapes (broadcaster_user_id alone, or paired
/// with moderator_user_id for channel.follow, or to_broadcaster_user_id for
/// raids) — so the frontend builds `condition` itself from the connected
/// account's own user id and passes it straight through.
#[tauri::command]
pub(crate) async fn alerts_eventsub_subscribe(
    session_id: String,
    sub_type: String,
    version: String,
    condition: Value,
) -> Result<Value, String> {
    let access_token = kr_get("twitch.access_token").ok_or("not connected to Twitch")?;
    let client_id = kr_get("twitch.client_id").ok_or("not connected to Twitch")?;

    async fn subscribe_once(
        client: &reqwest::Client,
        access_token: &str,
        client_id: &str,
        sub_type: &str,
        version: &str,
        condition: &Value,
        session_id: &str,
    ) -> Result<reqwest::Response, String> {
        client
            .post("https://api.twitch.tv/helix/eventsub/subscriptions")
            .bearer_auth(access_token)
            .header("Client-Id", client_id)
            .json(&serde_json::json!({
                "type": sub_type,
                "version": version,
                "condition": condition,
                "transport": { "method": "websocket", "session_id": session_id },
            }))
            .send()
            .await
            .map_err(|e| e.to_string())
    }

    let client = reqwest::Client::new();
    let mut resp = subscribe_once(&client, &access_token, &client_id, &sub_type, &version, &condition, &session_id).await?;
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        let fresh = refresh_access_token().await?;
        resp = subscribe_once(&client, &fresh, &client_id, &sub_type, &version, &condition, &session_id).await?;
    }
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("EventSub subscribe ({sub_type}) failed: {status} {body}"));
    }
    resp.json().await.map_err(|e| e.to_string())
}

/// Combined live status/viewer count, follower total, and subscriber total
/// for Stream Stats — one round trip (3 concurrent requests) rather than
/// three separate commands. Reuses this module's existing Twitch connection
/// (Alerts Hub's own OAuth) rather than a fourth Twitch login: `streams` and
/// `channels/followers` work with any valid token, and `channel:read:subscriptions`
/// (needed for `subscriptions`) is already one of the scopes Alerts Hub asks for.
#[tauri::command]
pub(crate) async fn twitch_stream_stats() -> Result<Value, String> {
    let access_token = kr_get("twitch.access_token").ok_or("Twitch not connected — connect it in Alerts Hub first")?;
    let client_id = kr_get("twitch.client_id").ok_or("Twitch not connected — connect it in Alerts Hub first")?;
    let user_id = kr_get("twitch.user_id").ok_or("Twitch not connected — connect it in Alerts Hub first")?;

    async fn get(client: &reqwest::Client, url: &str, params: &[(&str, &str)], access_token: &str, client_id: &str) -> Result<Value, String> {
        let mut resp = client
            .get(url)
            .query(params)
            .bearer_auth(access_token)
            .header("Client-Id", client_id)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            let fresh = refresh_access_token().await?;
            resp = client
                .get(url)
                .query(params)
                .bearer_auth(&fresh)
                .header("Client-Id", client_id)
                .send()
                .await
                .map_err(|e| e.to_string())?;
        }
        resp.json().await.map_err(|e| e.to_string())
    }

    let client = reqwest::Client::new();
    let stream_params = [("user_id", user_id.as_str())];
    let follower_params = [("broadcaster_id", user_id.as_str())];
    let sub_params = [("broadcaster_id", user_id.as_str())];
    let (stream_resp, followers_resp, subs_resp) = tokio::join!(
        get(&client, "https://api.twitch.tv/helix/streams", &stream_params, &access_token, &client_id),
        get(&client, "https://api.twitch.tv/helix/channels/followers", &follower_params, &access_token, &client_id),
        get(&client, "https://api.twitch.tv/helix/subscriptions", &sub_params, &access_token, &client_id),
    );

    let stream = stream_resp.ok().and_then(|v| v.pointer("/data/0").cloned());
    let follower_total = followers_resp.ok().and_then(|v| v.get("total").and_then(|t| t.as_i64()));
    // A stream not run by a Partner/Affiliate 400s on /subscriptions — that's
    // not a real error for stats purposes, just "no sub program", so it's
    // folded into `null` rather than failing the whole combined response.
    let subscriber_total = subs_resp.ok().and_then(|v| v.get("total").and_then(|t| t.as_i64()));

    Ok(serde_json::json!({
        "is_live": stream.is_some(),
        "viewer_count": stream.as_ref().and_then(|s| s.get("viewer_count")),
        "title": stream.as_ref().and_then(|s| s.get("title")),
        "game_name": stream.as_ref().and_then(|s| s.get("game_name")),
        "started_at": stream.as_ref().and_then(|s| s.get("started_at")),
        "follower_total": follower_total,
        "subscriber_total": subscriber_total,
    }))
}
