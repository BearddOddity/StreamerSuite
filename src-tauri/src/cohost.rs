// AI Co-Host's model backend — calls Hugging Face's Inference Providers
// router directly over HTTPS from this Rust process. No local runtime, no
// separate app to install (no Ollama/LM Studio) — the only external
// dependency is the Hugging Face API token already stored in Connections &
// Keys. True local (on-device) inference is a possible future addition, not
// this one.

use serde_json::{json, Value};
use std::time::Duration;

const HF_ROUTER_URL: &str = "https://router.huggingface.co/v1/chat/completions";

/// Builds the system prompt from persona + guardrails, calls the model, and
/// hard-truncates the reply to `max_response_length` regardless of what the
/// model actually returned — the length guardrail can't rely on the model
/// obeying the instruction alone.
#[tauri::command]
pub(crate) async fn cohost_generate_reply(
    message: String,
    persona: String,
    model: String,
    banned_topics: String,
    max_response_length: u32,
) -> Result<String, String> {
    if model.trim().is_empty() {
        return Err("No model selected".into());
    }
    if message.trim().is_empty() {
        return Err("Nothing to reply to".into());
    }

    let base = crate::app_base_dir()?;
    let config = crate::auth::load_config_at(&base)?;
    let token = config.api_keys.huggingface.clone();
    if token.is_empty() {
        return Err("Connect a Hugging Face API token in Settings → Connections & Keys first".into());
    }

    let cap = (max_response_length.max(20)) as usize;

    let mut system_prompt = persona.trim().to_string();
    if system_prompt.is_empty() {
        system_prompt = "You are a friendly, upbeat stream co-host.".into();
    }
    if !banned_topics.trim().is_empty() {
        system_prompt.push_str(&format!(
            "\n\nNever bring up or discuss the following topics, even if asked directly: {}.",
            banned_topics.trim()
        ));
    }
    system_prompt.push_str(&format!(
        "\n\nThis reply is going straight into a live stream chat — keep it under {cap} characters and to the point."
    ));

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": message },
        ],
        "max_tokens": 300,
    });

    let resp = client
        .post(HF_ROUTER_URL)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Hugging Face API error {status}: {text}"));
    }

    let payload: Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = payload["choices"]
        .get(0)
        .and_then(|c| c["message"]["content"].as_str())
        .ok_or("Hugging Face returned an unexpected response shape")?
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("Hugging Face returned an empty reply — try a different model".into());
    }

    Ok(truncate_chars(&content, cap))
}

fn truncate_chars(s: &str, cap: usize) -> String {
    if s.chars().count() <= cap {
        return s.to_string();
    }
    let mut truncated: String = s.chars().take(cap.saturating_sub(1)).collect();
    truncated.push('…');
    truncated
}

#[cfg(test)]
mod tests {
    use super::truncate_chars;

    #[test]
    fn truncate_chars_leaves_short_strings_untouched() {
        assert_eq!(truncate_chars("hello", 20), "hello");
    }

    #[test]
    fn truncate_chars_caps_and_adds_ellipsis() {
        let out = truncate_chars("this is a much longer reply than allowed", 10);
        assert_eq!(out.chars().count(), 10);
        assert!(out.ends_with('…'));
    }
}
