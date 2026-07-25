// Stream Manager — update title/category/tags on Twitch and Kick from one
// place. Deliberately reuses StatusForge's existing broadcaster connection
// (auth::load_config_at) rather than a fifth OAuth login in this app: it
// already carries the exact scope this needs (channel:manage:broadcast on
// Twitch, channel:write on Kick) since pusher.rs uses the same tokens for
// automatic category pushes on game detection.
//
// When StatusForge's own game-detection push is on
// (engine_settings.platform_push_enabled), that engine already owns the
// live category — the frontend hides the manual category field in that
// case rather than letting this module fight it. This module doesn't need
// to know that itself; it just updates whatever it's told to.
//
// Kick's direct API here can hit the same Cloudflare block a direct chat
// connection sometimes does (see multichat.rs) — the frontend offers an
// alternate path through Streamer.bot's WebSocket API (a user-authored
// Action running Kick's "Set Channel Title"/"Set Channel Category"
// sub-actions) for that case; see src/lib/streamerbot.ts. That path doesn't
// touch this module at all — it's a pure frontend WebSocket call.
//
// Joystick.tv has no verified API for this (see Stream Stats' reporting
// window) — StreamerSuite doesn't attempt it here either.
use crate::auth;
use serde_json::Value;

const TWITCH_GAMES_URL: &str = "https://api.twitch.tv/helix/games";
const TWITCH_CHANNELS_URL: &str = "https://api.twitch.tv/helix/channels";
const KICK_CHANNELS_URL: &str = "https://api.kick.com/public/v1/channels";
const KICK_CATEGORIES_URL: &str = "https://api.kick.com/public/v2/categories";

#[tauri::command]
pub(crate) async fn stream_manager_get_twitch_info() -> Result<Value, String> {
    let base = crate::app_base_dir()?;
    let config = auth::load_config_at(&base)?;
    let b = &config.broadcaster;
    if b.twitch_token.is_empty() || b.twitch_broadcaster_id.is_empty() {
        return Err("Twitch not connected — connect it in StatusForge Settings first".into());
    }
    let client = reqwest::Client::new();
    let resp = client
        .get(TWITCH_CHANNELS_URL)
        .query(&[("broadcaster_id", &b.twitch_broadcaster_id)])
        .header("Client-Id", &b.twitch_client)
        .bearer_auth(&b.twitch_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Twitch returned {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    body.pointer("/data/0").cloned().ok_or_else(|| "no channel info returned".into())
}

#[tauri::command]
pub(crate) async fn stream_manager_update_twitch(title: Option<String>, game_name: Option<String>, tags: Option<Vec<String>>) -> Result<String, String> {
    let base = crate::app_base_dir()?;
    let config = auth::load_config_at(&base)?;
    let b = &config.broadcaster;
    if b.twitch_token.is_empty() || b.twitch_broadcaster_id.is_empty() {
        return Err("Twitch not connected — connect it in StatusForge Settings first".into());
    }
    let client = reqwest::Client::new();

    let mut body = serde_json::Map::new();
    if let Some(t) = &title {
        if t.is_empty() {
            return Err("Title can't be empty".into());
        }
        body.insert("title".into(), Value::String(t.clone()));
    }
    if let Some(name) = &game_name {
        if name.is_empty() {
            body.insert("game_id".into(), Value::String("".into()));
        } else {
            let resp = client
                .get(TWITCH_GAMES_URL)
                .query(&[("name", name.as_str())])
                .header("Client-Id", &b.twitch_client)
                .bearer_auth(&b.twitch_token)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let json: Value = resp.json().await.map_err(|e| e.to_string())?;
            let game_id = json
                .pointer("/data/0/id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("couldn't find a Twitch category named \"{name}\""))?;
            body.insert("game_id".into(), Value::String(game_id.to_string()));
        }
    }
    if let Some(tags) = &tags {
        if tags.len() > 10 {
            return Err("Twitch allows at most 10 tags".into());
        }
        body.insert("tags".into(), Value::Array(tags.iter().cloned().map(Value::String).collect()));
    }
    if body.is_empty() {
        return Err("nothing to update".into());
    }

    let resp = client
        .patch(TWITCH_CHANNELS_URL)
        .query(&[("broadcaster_id", &b.twitch_broadcaster_id)])
        .header("Client-Id", &b.twitch_client)
        .bearer_auth(&b.twitch_token)
        .json(&Value::Object(body))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Twitch returned {status}: {text}"));
    }
    Ok("Twitch channel updated".into())
}

#[tauri::command]
pub(crate) async fn stream_manager_get_kick_info() -> Result<Value, String> {
    let base = crate::app_base_dir()?;
    let config = auth::load_config_at(&base)?;
    let b = &config.broadcaster;
    if b.kick_token.is_empty() || b.kick_channel_id.is_empty() {
        return Err("Kick not connected — connect it in StatusForge Settings first".into());
    }
    let client = reqwest::Client::new();
    let resp = client
        .get(KICK_CHANNELS_URL)
        .query(&[("slug", &b.kick_channel_id)])
        .bearer_auth(&b.kick_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Kick returned {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    body.pointer("/data/0").cloned().ok_or_else(|| "no channel info returned".into())
}

#[tauri::command]
pub(crate) async fn stream_manager_update_kick(title: Option<String>, category_name: Option<String>) -> Result<String, String> {
    let base = crate::app_base_dir()?;
    let config = auth::load_config_at(&base)?;
    let b = &config.broadcaster;
    if b.kick_token.is_empty() {
        return Err("Kick not connected — connect it in StatusForge Settings first".into());
    }
    let client = reqwest::Client::new();

    let mut body = serde_json::Map::new();
    if let Some(t) = &title {
        if t.is_empty() {
            return Err("Title can't be empty".into());
        }
        body.insert("stream_title".into(), Value::String(t.clone()));
    }
    if let Some(name) = &category_name {
        if !name.is_empty() {
            let resp = client
                .get(KICK_CATEGORIES_URL)
                .query(&[("name", name.as_str()), ("limit", "1")])
                .bearer_auth(&b.kick_token)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let json: Value = resp.json().await.map_err(|e| e.to_string())?;
            let category_id = json
                .pointer("/data/0/id")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| format!("couldn't find a Kick category named \"{name}\""))?;
            body.insert("category_id".into(), Value::Number(category_id.into()));
        }
    }
    if body.is_empty() {
        return Err("nothing to update".into());
    }

    let resp = client
        .patch(KICK_CHANNELS_URL)
        .bearer_auth(&b.kick_token)
        .json(&Value::Object(body))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Kick returned {status}: {text}"));
    }
    Ok("Kick channel updated".into())
}
