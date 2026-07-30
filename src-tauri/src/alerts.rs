// Alerts Hub — real Twitch follow/sub/raid/cheer alerts via EventSub over
// WebSocket. Used to hold its own separately-scoped Twitch OAuth connection
// (own keyring service, own loopback port) because the scopes it needs
// (moderator:read:followers/channel:read:subscriptions/bits:read) didn't
// overlap with StatusForge's or Multi-Chat's. Now that Twitch/Kick/Joystick
// credentials all live in one shared StatusForge AppConfig (see config.rs's
// BroadcasterConfig, connected from Settings → Connections & Keys), that
// connection request unions every consumer's scopes — see
// auth::build_twitch_auth_url — so this module just reads the shared token.
use serde_json::Value;

/// Loads the shared AppConfig (Config.json + OS keychain), same pattern
/// stream_manager.rs already uses — no more separate keyring service here.
fn shared_config() -> Result<crate::config::AppConfig, String> {
    let base = crate::app_base_dir()?;
    crate::auth::load_config_at(&base)
}

/// Refreshes the shared Twitch access token via the shared refresh token and
/// persists the new one (auth::save_config_at handles keychain re-sync for
/// an already-migrated install). Returns the new access token.
async fn refresh_access_token() -> Result<String, String> {
    let base = crate::app_base_dir()?;
    let config = crate::auth::load_config_at(&base)?;
    let new_token = crate::auth::refresh_twitch_token(&config)?;
    let mut updated = config;
    updated.broadcaster.twitch_token = new_token.clone();
    crate::auth::save_config_at(&base, &updated)?;
    Ok(new_token)
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
    let config = shared_config()?;
    let access_token = config.broadcaster.twitch_token.clone();
    let client_id = config.broadcaster.twitch_client.clone();
    if access_token.is_empty() || client_id.is_empty() {
        return Err(
            "Twitch not connected — connect it in StreamerSuite Settings → Connections & Keys"
                .into(),
        );
    }

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
/// three separate commands. Reads the shared Twitch connection (Settings →
/// Connections & Keys): `streams` and `channels/followers` work with any
/// valid token, and `channel:read:subscriptions` (needed for
/// `subscriptions`) is part of the shared connection's scope union.
#[tauri::command]
pub(crate) async fn twitch_stream_stats() -> Result<Value, String> {
    let config = shared_config()?;
    let access_token = config.broadcaster.twitch_token.clone();
    let client_id = config.broadcaster.twitch_client.clone();
    let user_id = config.broadcaster.twitch_broadcaster_id.clone();
    if access_token.is_empty() || client_id.is_empty() || user_id.is_empty() {
        return Err(
            "Twitch not connected — connect it in StreamerSuite Settings → Connections & Keys"
                .into(),
        );
    }

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

/// Per-alert-kind custom icon overrides (data: URI once uploaded, absent
/// means "use the default emoji") — owned here, not in the big AppConfig,
/// since these can be several MB of image data combined and have no
/// business going through Config.json's export/import/validate path.
/// Multi-Chat's chat-feed chips (raid/resub/gift/follow/tip/cheer) read
/// the same file rather than keeping their own separate copy — Alerts &
/// Events' five kinds (follow/sub/raid/cheer/tip) are coarser than
/// Multi-Chat's six, so its "resub" and "gift" chips both use this file's
/// "sub" icon.
#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub(crate) struct EventIcons {
    #[serde(default)]
    follow: Option<String>,
    #[serde(default)]
    sub: Option<String>,
    #[serde(default)]
    raid: Option<String>,
    #[serde(default)]
    cheer: Option<String>,
    #[serde(default)]
    tip: Option<String>,
}

fn event_icons_path() -> Result<std::path::PathBuf, String> {
    Ok(crate::app_base_dir()?.join("EventIcons.json"))
}

#[tauri::command]
pub(crate) fn alerts_get_event_icons() -> EventIcons {
    event_icons_path()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) fn alerts_set_event_icons(icons: EventIcons) -> Result<(), String> {
    let path = event_icons_path()?;
    let json = serde_json::to_string(&icons).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("couldn't write event icons: {e}"))
}
