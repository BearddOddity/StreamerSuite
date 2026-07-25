// Overlay Library — a central directory of every browser-source overlay
// StreamerSuite can serve, all through StatusForge's existing widget/OAuth
// server (127.0.0.1:53735) rather than a second server:
//   - built-in: the widget HTML files already bundled under widgets/
//   - alerts: the new live Alerts Hub overlay (see server.rs's alert
//     broadcast + widgets/alerts-overlay.html)
//   - custom: user-added files, copied into overlays/custom/ under the
//     app's base directory and served by server.rs's custom_overlay_handler
use serde::Serialize;

#[derive(Serialize)]
pub struct OverlayEntry {
    file: String,
    name: String,
    /// True when a `<stem>.overlay.json` or `<stem>.canvas.json` sidecar
    /// exists next to this file — i.e. it was built with the Overlay Maker
    /// (not a raw upload) and its settings can be reloaded for editing.
    editable: bool,
    /// Which Maker built this overlay, so the frontend opens the right
    /// editor — `None` for a plain upload (editable is always false then).
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<&'static str>,
}

/// The sidecar file a Maker-built overlay's settings are saved to, next to
/// its rendered HTML. Kept as a fully separate file (not a shared index or
/// database) so each overlay's settings are self-contained: editing one
/// overlay only ever reads/writes that one overlay's own pair of files and
/// can never touch another overlay's saved state.
fn params_sidecar_path(dir: &std::path::Path, html_file: &str) -> std::path::PathBuf {
    let stem = html_file.strip_suffix(".html").unwrap_or(html_file);
    dir.join(format!("{stem}.overlay.json"))
}

/// Same idea as `params_sidecar_path` but for a multi-element Canvas
/// overlay (see `CanvasParams`) — a distinct suffix rather than reusing
/// `.overlay.json` so `overlay_get_template_params` (which expects a raw
/// `TemplateParams` shape) never mis-parses a canvas sidecar or vice versa.
fn canvas_sidecar_path(dir: &std::path::Path, html_file: &str) -> std::path::PathBuf {
    let stem = html_file.strip_suffix(".html").unwrap_or(html_file);
    dir.join(format!("{stem}.canvas.json"))
}

fn custom_overlays_dir() -> Result<std::path::PathBuf, String> {
    let dir = crate::app_base_dir()?.join("overlays").join("custom");
    std::fs::create_dir_all(&dir).map_err(|e| format!("couldn't create overlays/custom: {e}"))?;
    Ok(dir)
}

fn humanize(file: &str) -> String {
    let stem = file.rsplit_once('.').map(|(s, _)| s).unwrap_or(file);
    stem.replace(['_', '-'], " ")
}

#[tauri::command]
pub(crate) fn overlay_list_builtin() -> Result<Vec<OverlayEntry>, String> {
    let dir = crate::app_base_dir()?.join("widgets");
    let mut entries = Vec::new();
    let read = std::fs::read_dir(&dir).map_err(|e| format!("couldn't read widgets: {e}"))?;
    for entry in read.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.ends_with(".html") {
            entries.push(OverlayEntry { name: humanize(&file_name), file: file_name, editable: false, kind: None });
        }
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

#[tauri::command]
pub(crate) fn overlay_list_custom() -> Result<Vec<OverlayEntry>, String> {
    let dir = custom_overlays_dir()?;
    let mut entries = Vec::new();
    let read = std::fs::read_dir(&dir).map_err(|e| format!("couldn't read overlays/custom: {e}"))?;
    for entry in read.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.ends_with(".overlay.json") || file_name.ends_with(".canvas.json") {
            continue; // a settings sidecar, not an overlay file itself
        }
        let is_template = params_sidecar_path(&dir, &file_name).exists();
        let is_canvas = canvas_sidecar_path(&dir, &file_name).exists();
        let editable = file_name.ends_with(".html") && (is_template || is_canvas);
        let kind = if is_canvas {
            Some("canvas")
        } else if is_template {
            Some("template")
        } else {
            None
        };
        entries.push(OverlayEntry { name: humanize(&file_name), file: file_name, editable, kind });
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

/// Copies a user-picked file (from the JS-side file dialog) into
/// `overlays/custom/`. Only the file name is trusted from the source path —
/// re-derives a clean destination name so a crafted source path can't smuggle
/// path segments into the managed directory.
#[tauri::command]
pub(crate) fn overlay_add_custom(source_path: String) -> Result<String, String> {
    let source = std::path::Path::new(&source_path);
    let dir = custom_overlays_dir()?;
    let file_name = source
        .file_name()
        .ok_or("invalid file path")?
        .to_string_lossy()
        .to_string();
    if file_name.contains("..") {
        return Err("invalid file name".into());
    }
    let dest = dir.join(&file_name);
    crate::assert_path_in_base(&dest, &dir)?;
    std::fs::copy(source, &dest).map_err(|e| format!("couldn't copy file: {e}"))?;
    Ok(file_name)
}

#[tauri::command]
pub(crate) fn overlay_remove_custom(file: String) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    let path = dir.join(&file);
    crate::assert_path_in_base(&path, &dir)?;
    std::fs::remove_file(&path).map_err(|e| format!("couldn't remove file: {e}"))?;
    // Best-effort — a plain uploaded file (not Maker-built) never had one.
    let _ = std::fs::remove_file(params_sidecar_path(&dir, &file));
    let _ = std::fs::remove_file(canvas_sidecar_path(&dir, &file));
    Ok(())
}

/// Forwards a live (or test) alert from Alerts Hub to every connected
/// `/alerts-ws` overlay browser source.
#[tauri::command]
pub(crate) fn alerts_broadcast_to_overlay(event: serde_json::Value) {
    crate::server::push_alert_event(event);
}

/// Published by Stream Stats/Stream Timer whenever they have a fresh value
/// (viewers, followers, subscribers, uptime, the timer display, …) so any
/// overlay built with a data-bound field can show it live. See
/// `server.rs`'s `/overlay-data` + `/data-ws`.
#[tauri::command]
pub(crate) fn overlay_publish_data(key: String, value: serde_json::Value) {
    crate::server::publish_overlay_data(key, value);
}

/// Every live-data key any tool has published so far this session — lets
/// the Overlay Maker's "bind to a live source" dropdown discover sources
/// from tools it doesn't know about in advance (see types.ts's
/// `KNOWN_LIVE_SOURCES` for the small set of sources it also always shows,
/// with a friendly label, whether or not they've published yet).
#[tauri::command]
pub(crate) fn overlay_list_data_keys() -> Vec<String> {
    crate::server::overlay_data_keys()
}

// --- Overlay Maker: template-based overlay generation ---

/// A field that's either static text or bound to a live value another tool
/// publishes via `overlay_publish_data` (see `LIVE_SOURCES` in types.ts for
/// the keys the frontend offers). `label` is shown as a prefix — e.g. text
/// "Followers" bound to `followers` renders as "Followers 1,234" and stays
/// current as Stream Stats republishes it.
#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub(crate) struct BoundField {
    #[serde(default)]
    text: String,
    #[serde(default)]
    source: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TemplateParams {
    template: String,
    #[serde(default)]
    title: BoundField,
    #[serde(default)]
    subtitle: BoundField,
    #[serde(default = "default_text_color")]
    text_color: String,
    #[serde(default = "default_accent_color")]
    accent_color: String,
    #[serde(default = "default_bg_opacity")]
    bg_opacity: f32,
    #[serde(default)]
    position: String,
    #[serde(default)]
    logo_data_uri: Option<String>,
    #[serde(default)]
    speed_seconds: Option<u32>,
    /// Google Fonts family name, same convention as StatusForge/Multi-Chat's
    /// own theme settings — empty (or unrecognized) just falls back to the
    /// bundled system font stack.
    #[serde(default)]
    font_family: String,
    #[serde(default = "default_border_radius")]
    border_radius: String,
    #[serde(default = "default_true")]
    animations_enabled: bool,
    /// "pop" (default) / "slide" / "fade" — which entrance keyframes
    /// animations_enabled turns on.
    #[serde(default = "default_animation_style")]
    animation_style: String,
    /// Goal Bar only — the target number the bound value is measured
    /// against (e.g. a follower goal of 1000).
    #[serde(default)]
    goal: Option<f64>,
    #[serde(default)]
    text_shadow: bool,
    #[serde(default)]
    text_stroke: bool,
    /// Countdown template only — an ISO 8601 datetime string the client
    /// ticks down to locally (no server round-trip, unlike every other
    /// bound field). Free text: invalid/unparseable values just render as
    /// placeholder dashes client-side rather than failing to save.
    #[serde(default)]
    countdown_target: String,
}

/// One placed widget inside a Canvas overlay (see `CanvasParams`/
/// `render_canvas`) — reuses the exact same `TemplateParams` a
/// single-widget overlay uses (same templates, same fields), just placed
/// at a free x/y/size instead of the fixed corner presets. `id` is
/// frontend-only bookkeeping (React key / drag target); the backend never
/// looks at it.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CanvasElement {
    #[serde(default)]
    id: String,
    #[serde(default = "default_x_pct")]
    x_pct: f32,
    #[serde(default = "default_y_pct")]
    y_pct: f32,
    #[serde(default = "default_size_pct")]
    width_pct: f32,
    #[serde(default = "default_size_pct")]
    height_pct: f32,
    #[serde(default)]
    z_index: i32,
    params: TemplateParams,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CanvasParams {
    #[serde(default)]
    elements: Vec<CanvasElement>,
}

fn default_x_pct() -> f32 {
    10.0
}
fn default_y_pct() -> f32 {
    10.0
}
fn default_size_pct() -> f32 {
    30.0
}

fn default_text_color() -> String {
    "#ffffff".into()
}
fn default_accent_color() -> String {
    "#9146ff".into()
}
fn default_bg_opacity() -> f32 {
    0.85
}
fn default_border_radius() -> String {
    "rounded".into()
}
fn default_true() -> bool {
    true
}
fn default_animation_style() -> String {
    "pop".into()
}

const FONT_STACK: &str = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/// Maps to the same three-step scale as StatusForge's theme settings
/// (`sharp` / `soft` / `rounded`).
fn radius_px(input: &str) -> &'static str {
    match input {
        "sharp" => "2px",
        "soft" => "8px",
        _ => "16px",
    }
}

/// Only letters, digits, spaces, and hyphens — enough for any real Google
/// Fonts family name, and safe to drop straight into both a CSS
/// `font-family` value and a Google Fonts URL query.
fn safe_font_family(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty()
        || trimmed.len() > 60
        || !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '-')
    {
        return None;
    }
    Some(trimmed.to_string())
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Only a plain `#rgb`/`#rrggbb` hex code is accepted for anything that
/// lands directly in generated CSS/inline styles — falls back to a known-
/// safe default rather than erroring, since a rejected color shouldn't block
/// saving the rest of the overlay.
fn safe_color(input: &str, fallback: &str) -> String {
    let is_hex = |s: &str| s.len() == 4 || s.len() == 7;
    if input.starts_with('#') && is_hex(input) && input[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        input.to_string()
    } else {
        fallback.to_string()
    }
}

/// Only `data:image/...` is accepted for a logo — rejects anything else
/// (e.g. a `javascript:` URL) rather than embedding it in the page.
fn safe_logo(input: &Option<String>) -> Option<String> {
    input
        .as_ref()
        .filter(|s| s.starts_with("data:image/"))
        .cloned()
}

fn clamp01(v: f32) -> f32 {
    v.clamp(0.0, 1.0)
}

/// Renders a bound field as HTML: static text is escaped and printed as-is;
/// a live-bound field gets a `data-bind` span the generated page's poller
/// (see `data_bind_script`) fills in and keeps current.
fn render_field(field: &BoundField, css_class: &str) -> String {
    let label = escape_html(field.text.trim());
    if field.source.trim().is_empty() {
        format!(r#"<span class="{css_class}">{label}</span>"#)
    } else {
        let source = escape_html(field.source.trim());
        format!(
            r#"<span class="{css_class}">{label} <span data-bind="{source}">—</span></span>"#
        )
    }
}

fn has_binding(params: &TemplateParams) -> bool {
    !params.title.source.trim().is_empty() || !params.subtitle.source.trim().is_empty()
}

/// Appended once, only when at least one field is data-bound, so a fully
/// static overlay never opens a WebSocket it has no use for. Connects to
/// `/data-ws`, formats each published value for its key, and fills in every
/// `[data-bind]` element that matches.
const DATA_BIND_SCRIPT: &str = r#"<script>
(function() {
  function fmt(key, value) {
    if (value == null) return "—";
    if (key === "uptime" || key === "timer") {
      var s = Math.max(0, Math.floor(Number(value) || 0));
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return [h, m, sec].map(function(n) { return String(n).padStart(2, "0"); }).join(":");
    }
    if (typeof value === "number") return value.toLocaleString();
    return String(value);
  }
  function apply(data) {
    document.querySelectorAll("[data-bind]").forEach(function(el) {
      var key = el.getAttribute("data-bind");
      el.textContent = fmt(key, data[key]);
    });
    // Goal Bar's fill — width is a percentage of the value against a fixed
    // goal baked in at save time, not something the server computes.
    document.querySelectorAll("[data-bind-width]").forEach(function(el) {
      var key = el.getAttribute("data-bind-width");
      var goal = Number(el.getAttribute("data-goal")) || 0;
      var value = Number(data[key]) || 0;
      var pct = goal > 0 ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0;
      el.style.width = pct + "%";
    });
  }
  function connect() {
    var token = getOverlayToken();
    // No token in the URL means this page isn't loaded from a real
    // /forge-overlay or /custom-overlay path (e.g. the Overlay Maker's own
    // live preview, which renders via srcDoc and has no such URL) — skip
    // connecting rather than opening a WebSocket the server will reject.
    if (!token) return;
    var ws = new WebSocket("ws://127.0.0.1:53735/data-ws?token=" + token);
    ws.onmessage = function(ev) { try { apply(JSON.parse(ev.data)); } catch (e) {} };
    ws.onclose = function() { setTimeout(connect, 3000); };
    ws.onerror = function() { ws.close(); };
  }
  connect();
})();
</script>"#;

/// Extracts the overlay token from the page's own URL the same way
/// `widgets/alerts-overlay.html` does — `getOverlayToken()` inline rather
/// than baking the token into the saved file, so a regenerated/rotated
/// token doesn't strand every overlay already built with the old one.
const TOKEN_FROM_PATH_JS: &str = r#"
function getOverlayToken() {
  var parts = window.location.pathname.split("/");
  for (var i = 0; i < parts.length; i++) {
    if ((parts[i] === "forge-overlay" || parts[i] === "custom-overlay") && parts[i + 1]) return parts[i + 1];
  }
  // A Canvas overlay's elements each render as a same-origin `srcdoc`
  // iframe (see render_canvas) — no real URL of their own, so a bound
  // field inside one falls back to asking the parent canvas page, which
  // does have the real /custom-overlay/<token> URL this was resolved from.
  try {
    if (window.parent && window.parent !== window && typeof window.parent.getOverlayToken === "function") {
      return window.parent.getOverlayToken();
    }
  } catch (e) {}
  return "";
}
"#;

/// Countdown template only — ticks entirely client-side against
/// `data-target` (an ISO datetime string), no server round-trip and no
/// dependency on `DATA_BIND_SCRIPT`/overlay_publish_data at all.
const COUNTDOWN_SCRIPT: &str = r#"<script>
(function() {
  var el = document.getElementById("sb-countdown");
  if (!el) return;
  var target = new Date(el.getAttribute("data-target")).getTime();
  function tick() {
    if (isNaN(target)) { el.textContent = "--d --:--:--"; return; }
    var diff = Math.max(0, target - Date.now());
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s %= 86400;
    var h = Math.floor(s / 3600); s %= 3600;
    var m = Math.floor(s / 60); s %= 60;
    function pad(n) { return String(n).padStart(2, "0"); }
    el.textContent = d + "d " + pad(h) + ":" + pad(m) + ":" + pad(s);
  }
  tick();
  setInterval(tick, 1000);
})();
</script>"#;

fn render_template(params: &TemplateParams) -> Result<String, String> {
    let text_color = safe_color(&params.text_color, &default_text_color());
    let accent = safe_color(&params.accent_color, &default_accent_color());
    let bg_opacity = clamp01(params.bg_opacity);
    let radius = radius_px(&params.border_radius);
    let logo = safe_logo(&params.logo_data_uri);
    let logo_html = logo
        .map(|src| format!(r#"<img class="logo" src="{src}" alt="">"#))
        .unwrap_or_default();
    let title_html = render_field(&params.title, "title");
    let subtitle_html = render_field(&params.subtitle, "subtitle");

    // Same convention as StatusForge/Multi-Chat's own theme settings: an
    // optional Google Fonts family, loaded via a <link> tag, that falls
    // back to the bundled system stack when unset or invalid.
    let font_family = safe_font_family(&params.font_family);
    let font_css = font_family
        .as_ref()
        .map(|f| format!("\"{f}\", {FONT_STACK}"))
        .unwrap_or_else(|| FONT_STACK.to_string());
    let font_link = font_family
        .as_ref()
        .map(|f| {
            let query = f.replace(' ', "+");
            format!(
                r#"<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={query}:wght@400;500;700;800&display=swap">"#
            )
        })
        .unwrap_or_default();

    // A subtle pop-in, same spirit as widgets/alerts-overlay.html's entrance
    // animation — off entirely (not just neutralized) when the user disables
    // animations, so a disabled overlay never even defines the keyframes.
    let (card_animation, keyframes) = if params.animations_enabled {
        match params.animation_style.as_str() {
            "slide" => (
                "animation: overlay-slide-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;",
                "@keyframes overlay-slide-in { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }",
            ),
            "fade" => (
                "animation: overlay-fade-in 0.5s ease forwards;",
                "@keyframes overlay-fade-in { from { opacity: 0; } to { opacity: 1; } }",
            ),
            _ => (
                "animation: overlay-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;",
                "@keyframes overlay-pop-in { from { opacity: 0; transform: scale(0.9) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }",
            ),
        }
    } else {
        ("", "")
    };

    let (position_css, body_html, extra_style) = match params.template.as_str() {
        "lower-third" => {
            let align = match params.position.as_str() {
                "bottom-right" => "right: 40px; align-items: flex-end; text-align: right;",
                "bottom-center" => "left: 50%; transform: translateX(-50%); align-items: center; text-align: center;",
                _ => "left: 40px; align-items: flex-start; text-align: left;",
            };
            (
                format!("position: fixed; bottom: 40px; display: flex; flex-direction: column; gap: 4px; {align}"),
                format!(
                    r#"<div id="card"><div class="accent-bar"></div><div class="text">{logo_html}{title_html}{subtitle_html}</div></div>"#
                ),
                format!(
                    "#card {{ display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); {card_animation} }}\n\
                     .accent-bar {{ width: 6px; align-self: stretch; border-radius: 4px; background: {accent}; }}\n\
                     .text {{ display: flex; flex-direction: column; gap: 2px; }}\n\
                     .title {{ font-size: 26px; font-weight: 800; color: {text_color}; }}\n\
                     .subtitle {{ font-size: 15px; font-weight: 500; color: {text_color}; opacity: 0.75; }}\n\
                     .logo {{ height: 40px; width: auto; border-radius: 6px; }}\n\
                     {keyframes}"
                ),
            )
        }
        "corner-badge" => {
            let corner_css = match params.position.as_str() {
                "top-left" => "top: 30px; left: 30px;",
                "top-right" => "top: 30px; right: 30px;",
                "bottom-right" => "bottom: 30px; right: 30px;",
                _ => "bottom: 30px; left: 30px;",
            };
            (
                format!("position: fixed; {corner_css}"),
                format!(r#"<div id="card">{logo_html}<div class="text">{title_html}{subtitle_html}</div></div>"#),
                format!(
                    "#card {{ display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 999px; background: rgba(5, 5, 5, {bg_opacity}); border: 2px solid {accent}; box-shadow: 0 0 20px {accent}55; {card_animation} }}\n\
                     .text {{ display: flex; flex-direction: column; }}\n\
                     .title {{ font-size: 16px; font-weight: 800; color: {text_color}; }}\n\
                     .subtitle {{ font-size: 12px; color: {text_color}; opacity: 0.75; }}\n\
                     .logo {{ height: 28px; width: 28px; border-radius: 50%; object-fit: cover; }}\n\
                     {keyframes}"
                ),
            )
        }
        "ticker" => {
            let side_css = if params.position == "top" { "top: 0;" } else { "bottom: 0;" };
            let duration = params.speed_seconds.unwrap_or(18).clamp(4, 120);
            (
                format!("position: fixed; left: 0; right: 0; {side_css}"),
                format!(
                    r#"<div id="bar"><div id="track">{logo_html}{title_html}{subtitle_html}</div></div>"#
                ),
                format!(
                    "#bar {{ width: 100%; overflow: hidden; padding: 10px 0; background: rgba(5, 5, 5, {bg_opacity}); border-top: 2px solid {accent}; border-bottom: 2px solid {accent}; }}\n\
                     #track {{ display: inline-flex; align-items: center; gap: 20px; white-space: nowrap; padding-left: 100%; animation: scroll {duration}s linear infinite; }}\n\
                     .title {{ font-size: 20px; font-weight: 800; color: {text_color}; }}\n\
                     .subtitle {{ font-size: 16px; color: {text_color}; opacity: 0.8; }}\n\
                     .logo {{ height: 26px; width: auto; }}\n\
                     @keyframes scroll {{ from {{ transform: translateX(0); }} to {{ transform: translateX(-200%); }} }}"
                ),
            )
        }
        "text-box" => {
            let place_css = match params.position.as_str() {
                "top-left" => "top: 40px; left: 40px;",
                "top-right" => "top: 40px; right: 40px;",
                "bottom-left" => "bottom: 40px; left: 40px;",
                "bottom-right" => "bottom: 40px; right: 40px;",
                _ => "top: 50%; left: 50%; transform: translate(-50%, -50%);",
            };
            (
                format!("position: fixed; {place_css}"),
                format!(r#"<div id="card">{logo_html}<div class="text">{title_html}{subtitle_html}</div></div>"#),
                format!(
                    "#card {{ display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 40px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); border: 2px solid {accent}; text-align: center; {card_animation} }}\n\
                     .title {{ font-size: 34px; font-weight: 800; color: {text_color}; }}\n\
                     .subtitle {{ font-size: 18px; color: {text_color}; opacity: 0.8; }}\n\
                     .logo {{ height: 56px; width: auto; }}\n\
                     {keyframes}"
                ),
            )
        }
        "goal-bar" => {
            let place_css = match params.position.as_str() {
                "top" => "top: 40px; left: 50%; transform: translateX(-50%);",
                _ => "bottom: 40px; left: 50%; transform: translateX(-50%);",
            };
            let goal_num = params.goal.filter(|g| *g > 0.0).unwrap_or(100.0);
            let goal = if goal_num.fract() == 0.0 {
                format!("{goal_num:.0}")
            } else {
                format!("{goal_num}")
            };
            let source = params.subtitle.source.trim();
            let (current_html, fill_attrs) = if source.is_empty() {
                ("<span class=\"goal-current\">0</span>".to_string(), String::new())
            } else {
                let source = escape_html(source);
                (
                    format!(r#"<span class="goal-current" data-bind="{source}">0</span>"#),
                    format!(r#" data-bind-width="{source}" data-goal="{goal}""#),
                )
            };
            (
                format!("position: fixed; {place_css}"),
                format!(
                    r#"<div id="card"><div class="goal-label">{title_html}</div><div class="goal-row">{current_html}<span class="goal-sep"> / </span><span class="goal-total">{goal}</span></div><div class="goal-track"><div class="goal-fill"{fill_attrs}></div></div></div>"#
                ),
                format!(
                    "#card {{ display: flex; flex-direction: column; gap: 8px; padding: 16px 22px; min-width: 280px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); border: 2px solid {accent}; {card_animation} }}\n\
                     .goal-label {{ font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: {text_color}; opacity: 0.8; }}\n\
                     .goal-row {{ font-size: 24px; font-weight: 800; color: {text_color}; }}\n\
                     .goal-sep {{ opacity: 0.5; font-weight: 500; }}\n\
                     .goal-total {{ opacity: 0.7; }}\n\
                     .goal-track {{ height: 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }}\n\
                     .goal-fill {{ height: 100%; width: 0%; border-radius: 999px; background: {accent}; transition: width 0.6s ease; }}\n\
                     {keyframes}"
                ),
            )
        }
        "cam-frame" => {
            let corner_css = match params.position.as_str() {
                "top-left" => "top: 30px; left: 30px;",
                "top-right" => "top: 30px; right: 30px;",
                "bottom-right" => "bottom: 30px; right: 30px;",
                _ => "bottom: 30px; left: 30px;",
            };
            let has_label = !params.title.text.trim().is_empty() || !params.title.source.trim().is_empty();
            let badge_html = if has_label {
                format!(r#"<div id="card">{logo_html}{title_html}</div>"#)
            } else {
                String::new()
            };
            (
                format!("position: fixed; {corner_css}"),
                format!(r#"<div id="frame"></div>{badge_html}"#),
                format!(
                    "#frame {{ position: fixed; inset: 6px; border: 6px solid {accent}; border-radius: {radius}; box-shadow: inset 0 0 24px {accent}66; pointer-events: none; }}\n\
                     #card {{ display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: rgba(5, 5, 5, {bg_opacity}); border: 2px solid {accent}; {card_animation} }}\n\
                     .title {{ font-size: 14px; font-weight: 800; color: {text_color}; }}\n\
                     .subtitle {{ font-size: 11px; color: {text_color}; opacity: 0.75; }}\n\
                     .logo {{ height: 24px; width: 24px; border-radius: 50%; object-fit: cover; }}\n\
                     {keyframes}"
                ),
            )
        }
        "alert-banner" => {
            let corner_css = match params.position.as_str() {
                "top-left" => "top: 30px; left: 30px;",
                "top-right" => "top: 30px; right: 30px;",
                "bottom-left" => "bottom: 30px; left: 30px;",
                _ => "bottom: 30px; right: 30px;",
            };
            (
                format!("position: fixed; {corner_css}"),
                format!(
                    r#"<div id="card"><div class="pulse-ring"></div>{logo_html}<div class="text">{title_html}{subtitle_html}</div></div>"#
                ),
                format!(
                    "#card {{ position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 22px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); border: 2px solid {accent}; box-shadow: 0 0 24px {accent}88; {card_animation} }}\n\
                     .pulse-ring {{ position: absolute; inset: -2px; border-radius: {radius}; border: 2px solid {accent}; animation: alert-pulse 1.4s ease-out infinite; }}\n\
                     .text {{ display: flex; flex-direction: column; gap: 2px; }}\n\
                     .title {{ font-size: 20px; font-weight: 800; color: {text_color}; text-transform: uppercase; letter-spacing: 0.03em; }}\n\
                     .subtitle {{ font-size: 15px; font-weight: 600; color: {text_color}; opacity: 0.85; }}\n\
                     .logo {{ height: 34px; width: 34px; border-radius: 50%; object-fit: cover; }}\n\
                     @keyframes alert-pulse {{ 0% {{ opacity: 0.7; transform: scale(1); }} 100% {{ opacity: 0; transform: scale(1.08); }} }}\n\
                     {keyframes}"
                ),
            )
        }
        "countdown" => {
            let place_css = match params.position.as_str() {
                "top-left" => "top: 40px; left: 40px;",
                "top-right" => "top: 40px; right: 40px;",
                "bottom-left" => "bottom: 40px; left: 40px;",
                "bottom-right" => "bottom: 40px; right: 40px;",
                _ => "top: 50%; left: 50%; transform: translate(-50%, -50%);",
            };
            let target = escape_html(params.countdown_target.trim());
            (
                format!("position: fixed; {place_css}"),
                format!(
                    r#"<div id="card">{logo_html}{title_html}<div class="countdown" id="sb-countdown" data-target="{target}">--d --:--:--</div>{subtitle_html}</div>"#
                ),
                format!(
                    "#card {{ display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 36px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); border: 2px solid {accent}; text-align: center; {card_animation} }}\n\
                     .title {{ font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: {text_color}; opacity: 0.8; }}\n\
                     .countdown {{ font-size: 40px; font-weight: 800; color: {text_color}; font-variant-numeric: tabular-nums; }}\n\
                     .subtitle {{ font-size: 14px; color: {text_color}; opacity: 0.7; }}\n\
                     {keyframes}"
                ),
            )
        }
        other => return Err(format!("unknown template: {other}")),
    };

    let mut script = if has_binding(params) {
        format!("<script>{TOKEN_FROM_PATH_JS}</script>{DATA_BIND_SCRIPT}")
    } else {
        String::new()
    };
    if params.template == "countdown" {
        script.push_str(COUNTDOWN_SCRIPT);
    }

    // Applied globally (harmless no-op for classes the current template
    // doesn't use) rather than threaded through every template arm above.
    let mut text_effects = String::new();
    if params.text_shadow {
        text_effects.push_str("text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 0, 0, 0.4);");
    }
    if params.text_stroke {
        text_effects.push_str("-webkit-text-stroke: 1px rgba(0, 0, 0, 0.7);");
    }
    let text_effects_css = if text_effects.is_empty() {
        String::new()
    } else {
        format!(".title, .subtitle, .goal-row, .goal-label, .countdown {{ {text_effects} }}")
    };

    Ok(format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>StreamerSuite Overlay</title>
{font_link}
<style>
  html, body {{ margin: 0; padding: 0; background: transparent; overflow: hidden; font-family: {font_css}; }}
  #card, #bar {{ {position_css} }}
  {extra_style}
  {text_effects_css}
</style>
</head>
<body>
{body_html}
{script}
</body>
</html>
"#
    ))
}

#[tauri::command]
pub(crate) fn overlay_preview_template(params: TemplateParams) -> Result<String, String> {
    render_template(&params)
}

/// A Canvas overlay is one page holding several independently-placed
/// widgets. Rather than teaching every template arm above to render inside
/// a shared, CSS-scoped fragment (real risk of `.title`/`#card` rules from
/// one element bleeding into another), each element keeps rendering as its
/// own complete, self-contained document via `render_template` — exactly
/// as it does standalone — and this just places one `srcdoc` iframe per
/// element at its assigned x/y/size/z-order. Full CSS isolation between
/// elements for free, and every existing per-template test stays valid
/// unmodified since `render_template` itself didn't change at all.
fn render_canvas(elements: &[CanvasElement]) -> Result<String, String> {
    let mut iframes = String::new();
    let mut assigns = String::new();
    for (i, el) in elements.iter().enumerate() {
        let inner_html = render_template(&el.params)?;
        let x = el.x_pct.clamp(0.0, 100.0);
        let y = el.y_pct.clamp(0.0, 100.0);
        let w = el.width_pct.clamp(2.0, 100.0);
        let h = el.height_pct.clamp(2.0, 100.0);
        let z = el.z_index;
        let frame_id = format!("el-{i}");
        iframes.push_str(&format!(
            r#"<iframe id="{frame_id}" class="el" style="left:{x}%; top:{y}%; width:{w}%; height:{h}%; z-index:{z};"></iframe>"#
        ));
        // JSON-encoding the whole rendered document is what makes embedding
        // it safely inside a <script> block trivial — serde_json already
        // escapes quotes, newlines, and (critically) any literal `</script>`
        // sequence the inner HTML happens to contain.
        let json = serde_json::to_string(&inner_html).map_err(|e| e.to_string())?;
        assigns.push_str(&format!("document.getElementById(\"{frame_id}\").srcdoc = {json};\n"));
    }
    Ok(format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>StreamerSuite Overlay</title>
<style>
  html, body {{ margin: 0; padding: 0; background: transparent; overflow: hidden; }}
  .el {{ position: absolute; border: 0; background: transparent; }}
</style>
</head>
<body>
{iframes}
<script>
{TOKEN_FROM_PATH_JS}
{assigns}
</script>
</body>
</html>
"#
    ))
}

#[tauri::command]
pub(crate) fn overlay_preview_canvas(elements: Vec<CanvasElement>) -> Result<String, String> {
    render_canvas(&elements)
}

fn write_canvas_sidecar(dir: &std::path::Path, html_file: &str, canvas: &CanvasParams) -> Result<(), String> {
    let json = serde_json::to_string(canvas).map_err(|e| format!("couldn't serialize overlay settings: {e}"))?;
    std::fs::write(canvas_sidecar_path(dir, html_file), json)
        .map_err(|e| format!("couldn't write overlay settings: {e}"))
}

/// Creates a brand-new Canvas overlay file with a freshly allocated
/// (guaranteed unique) name — same non-collision guarantee as
/// `overlay_create_from_template`. Named after its first element's title,
/// falling back to "canvas" for an empty/all-static canvas.
#[tauri::command]
pub(crate) fn overlay_create_from_canvas(elements: Vec<CanvasElement>) -> Result<String, String> {
    let html = render_canvas(&elements)?;
    let dir = custom_overlays_dir()?;
    let title = elements.first().map(|e| e.params.title.text.clone()).unwrap_or_default();
    let slug = slugify(&title, "canvas");
    let file_name = unique_file_name(&dir, &slug);
    let dest = dir.join(&file_name);
    crate::assert_path_in_base(&dest, &dir)?;
    std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
    write_canvas_sidecar(&dir, &file_name, &CanvasParams { elements })?;
    Ok(file_name)
}

/// Loads a Canvas-built overlay's saved elements back for editing. `Ok(None)`
/// for anything without a `.canvas.json` sidecar (a plain upload, or a
/// single-template overlay — see `overlay_get_template_params` for that one).
#[tauri::command]
pub(crate) fn overlay_get_canvas_params(file: String) -> Result<Option<CanvasParams>, String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    crate::assert_path_in_base(&dir.join(&file), &dir)?;
    let sidecar = canvas_sidecar_path(&dir, &file);
    if !sidecar.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&sidecar).map_err(|e| format!("couldn't read overlay settings: {e}"))?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|e| format!("couldn't parse overlay settings: {e}"))
}

/// Re-renders and overwrites one specific, already-existing Canvas overlay
/// file — same "can only ever touch the file it was opened from" guarantee
/// as `overlay_update_template`.
#[tauri::command]
pub(crate) fn overlay_update_canvas(file: String, elements: Vec<CanvasElement>) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    let dest = dir.join(&file);
    crate::assert_path_in_base(&dest, &dir)?;
    if !dest.exists() {
        return Err("overlay not found".into());
    }
    let html = render_canvas(&elements)?;
    std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
    write_canvas_sidecar(&dir, &file, &CanvasParams { elements })
}

fn slugify(title: &str, template: &str) -> String {
    let base = if title.trim().is_empty() {
        template.to_string()
    } else {
        title.trim().to_lowercase()
    };
    let mut slug: String = base
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "overlay".to_string()
    } else {
        slug.to_string()
    }
}

fn unique_file_name(dir: &std::path::Path, slug: &str) -> String {
    let mut candidate = format!("{slug}.html");
    let mut n = 2;
    while dir.join(&candidate).exists() {
        candidate = format!("{slug}-{n}.html");
        n += 1;
    }
    candidate
}

fn write_params_sidecar(dir: &std::path::Path, html_file: &str, params: &TemplateParams) -> Result<(), String> {
    let json = serde_json::to_string(params).map_err(|e| format!("couldn't serialize overlay settings: {e}"))?;
    std::fs::write(params_sidecar_path(dir, html_file), json)
        .map_err(|e| format!("couldn't write overlay settings: {e}"))
}

/// Creates a brand-new overlay file with a freshly allocated (guaranteed
/// unique) name — never reuses or touches an existing file, so this can't
/// collide with or overwrite another overlay no matter what title is typed.
#[tauri::command]
pub(crate) fn overlay_create_from_template(params: TemplateParams) -> Result<String, String> {
    let html = render_template(&params)?;
    let dir = custom_overlays_dir()?;
    let slug = slugify(&params.title.text, &params.template);
    let file_name = unique_file_name(&dir, &slug);
    let dest = dir.join(&file_name);
    crate::assert_path_in_base(&dest, &dir)?;
    std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
    write_params_sidecar(&dir, &file_name, &params)?;
    Ok(file_name)
}

/// Loads a Maker-built overlay's saved settings back for editing. Returns
/// `Ok(None)` for a plain uploaded file (no sidecar) rather than an error —
/// that's just "not editable", not a failure.
#[tauri::command]
pub(crate) fn overlay_get_template_params(file: String) -> Result<Option<TemplateParams>, String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    let sidecar = params_sidecar_path(&dir, &file);
    crate::assert_path_in_base(&dir.join(&file), &dir)?;
    if !sidecar.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&sidecar).map_err(|e| format!("couldn't read overlay settings: {e}"))?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|e| format!("couldn't parse overlay settings: {e}"))
}

/// Re-renders and overwrites one specific, already-existing overlay file —
/// `file` is never re-derived from the title, so an edit always lands on
/// exactly the file it was opened from and can never rename itself into (or
/// collide with) a different overlay. To make a variant instead of
/// overwriting the original, the frontend calls `overlay_create_from_template`
/// with a loaded overlay's settings rather than this command.
#[tauri::command]
pub(crate) fn overlay_update_template(file: String, params: TemplateParams) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    let dest = dir.join(&file);
    crate::assert_path_in_base(&dest, &dir)?;
    if !dest.exists() {
        return Err("overlay not found".into());
    }
    let html = render_template(&params)?;
    std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
    write_params_sidecar(&dir, &file, &params)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(template: &str) -> TemplateParams {
        TemplateParams {
            template: template.to_string(),
            title: BoundField { text: "Hello <World>".to_string(), source: String::new() },
            subtitle: BoundField::default(),
            text_color: default_text_color(),
            accent_color: default_accent_color(),
            bg_opacity: default_bg_opacity(),
            position: String::new(),
            logo_data_uri: None,
            speed_seconds: None,
            font_family: String::new(),
            border_radius: default_border_radius(),
            animations_enabled: true,
            animation_style: default_animation_style(),
            goal: None,
            text_shadow: false,
            text_stroke: false,
            countdown_target: String::new(),
        }
    }

    fn canvas_element(id: &str, template: &str, x: f32, y: f32, z: i32) -> CanvasElement {
        CanvasElement {
            id: id.to_string(),
            x_pct: x,
            y_pct: y,
            width_pct: 30.0,
            height_pct: 20.0,
            z_index: z,
            params: params(template),
        }
    }

    #[test]
    fn canvas_renders_one_isolated_iframe_per_element_with_position_and_z_order() {
        let elements = vec![
            canvas_element("a", "lower-third", 5.0, 10.0, 1),
            canvas_element("b", "goal-bar", 60.0, 70.0, 2),
        ];
        let html = render_canvas(&elements).unwrap();
        assert!(html.contains(r#"id="el-0""#));
        assert!(html.contains(r#"id="el-1""#));
        assert!(html.contains("left:5%"));
        assert!(html.contains("top:10%"));
        assert!(html.contains("z-index:1"));
        assert!(html.contains("left:60%"));
        assert!(html.contains("z-index:2"));
        // Each element's full document (including its own <style>) is
        // embedded as a JSON-encoded srcdoc assignment, not inlined raw —
        // that's what keeps their CSS from colliding.
        assert!(html.contains("srcdoc ="));
        assert!(html.contains("Hello \\u003cWorld\\u003e") || html.contains("Hello &lt;World&gt;"));
    }

    #[test]
    fn canvas_clamps_position_and_size_to_sane_bounds() {
        let mut el = canvas_element("a", "text-box", 500.0, -50.0, 0);
        el.width_pct = 1000.0;
        el.height_pct = 0.0;
        let html = render_canvas(&[el]).unwrap();
        assert!(html.contains("left:100%"));
        assert!(html.contains("top:0%"));
        assert!(html.contains("width:100%"));
        assert!(html.contains("height:2%"));
    }

    #[test]
    fn canvas_round_trips_through_create_load_update() {
        let dir = std::env::temp_dir().join(format!("sf-canvas-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        let elements = vec![canvas_element("a", "lower-third", 5.0, 10.0, 1)];
        let html = render_canvas(&elements).unwrap();
        let file_name = "canvas-test.html";
        std::fs::write(dir.join(file_name), html).unwrap();
        write_canvas_sidecar(&dir, file_name, &CanvasParams { elements: elements.clone() }).unwrap();

        let sidecar = canvas_sidecar_path(&dir, file_name);
        assert!(sidecar.exists());
        let loaded: CanvasParams = serde_json::from_str(&std::fs::read_to_string(&sidecar).unwrap()).unwrap();
        assert_eq!(loaded.elements.len(), 1);
        assert_eq!(loaded.elements[0].id, "a");

        // A template sidecar path must never collide with the canvas one
        // for the same stem, so both kinds can coexist without stomping
        // each other (not that a single file is ever both, but the paths
        // themselves must be distinct).
        assert_ne!(canvas_sidecar_path(&dir, file_name), params_sidecar_path(&dir, file_name));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn renders_all_templates_and_escapes_text() {
        for t in [
            "lower-third", "corner-badge", "ticker", "text-box", "goal-bar", "cam-frame",
            "alert-banner", "countdown",
        ] {
            let html = render_template(&params(t)).unwrap();
            assert!(html.contains("Hello &lt;World&gt;"), "template {t} should escape title text");
            assert!(!html.contains("Hello <World>"), "template {t} should not contain raw unescaped text");
            assert!(html.contains(&default_accent_color()), "template {t} should use the accent color");
        }
    }

    #[test]
    fn rejects_unknown_template() {
        let mut p = params("not-a-real-template");
        p.template = "not-a-real-template".to_string();
        assert!(render_template(&p).is_err());
    }

    #[test]
    fn falls_back_on_invalid_color() {
        let mut p = params("lower-third");
        p.accent_color = "javascript:alert(1)".to_string();
        let html = render_template(&p).unwrap();
        assert!(!html.contains("javascript:"));
        assert!(html.contains(&default_accent_color()));
    }

    #[test]
    fn rejects_non_data_uri_logo() {
        let mut p = params("corner-badge");
        p.logo_data_uri = Some("https://evil.example/x.png".to_string());
        let html = render_template(&p).unwrap();
        assert!(!html.contains("evil.example"));
        assert!(!html.contains("<img"));
    }

    #[test]
    fn accepts_data_uri_logo() {
        let mut p = params("corner-badge");
        p.logo_data_uri = Some("data:image/png;base64,AAAA".to_string());
        let html = render_template(&p).unwrap();
        assert!(html.contains(r#"src="data:image/png;base64,AAAA""#));
    }

    #[test]
    fn no_data_ws_script_when_nothing_bound() {
        let html = render_template(&params("text-box")).unwrap();
        assert!(!html.contains("data-ws"));
    }

    #[test]
    fn adds_data_bind_span_and_script_when_bound() {
        let mut p = params("lower-third");
        p.subtitle = BoundField { text: "Followers".to_string(), source: "followers".to_string() };
        let html = render_template(&p).unwrap();
        assert!(html.contains(r#"data-bind="followers""#));
        assert!(html.contains("/data-ws?token="));
    }

    #[test]
    fn slugify_prefers_title_falls_back_to_template() {
        assert_eq!(slugify("My Cool Overlay!", "lower-third"), "my-cool-overlay");
        assert_eq!(slugify("   ", "corner-badge"), "corner-badge");
    }

    #[test]
    fn countdown_embeds_target_and_ticker_script_only_for_countdown_template() {
        let mut p = params("countdown");
        p.countdown_target = "2026-12-25T00:00:00".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains(r#"data-target="2026-12-25T00:00:00""#));
        assert!(html.contains("sb-countdown"));

        let other = render_template(&params("lower-third")).unwrap();
        assert!(!other.contains("sb-countdown"), "countdown script shouldn't leak into other templates");
    }

    #[test]
    fn animation_style_selects_distinct_keyframes() {
        let mut p = params("text-box");
        p.animation_style = "slide".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains("overlay-slide-in"));
        assert!(!html.contains("overlay-pop-in"));

        p.animation_style = "fade".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains("overlay-fade-in"));
    }

    #[test]
    fn unique_file_name_avoids_collisions() {
        let dir = std::env::temp_dir().join(format!("sf-overlay-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("test.html"), "x").unwrap();
        assert_eq!(unique_file_name(&dir, "test"), "test-2.html");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn custom_font_family_loads_google_font_and_sets_css() {
        let mut p = params("lower-third");
        p.font_family = "Bebas Neue".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains("fonts.googleapis.com/css2?family=Bebas+Neue"));
        assert!(html.contains(r#""Bebas Neue","#));
    }

    #[test]
    fn invalid_font_family_falls_back_to_system_stack_no_google_link() {
        let mut p = params("lower-third");
        p.font_family = "Bebas'; </style><script>alert(1)</script>".to_string();
        let html = render_template(&p).unwrap();
        assert!(!html.contains("fonts.googleapis.com"));
        assert!(!html.contains("<script>alert(1)</script>"));
    }

    #[test]
    fn border_radius_scale_matches_app_theme_settings() {
        for (input, px) in [("sharp", "2px"), ("soft", "8px"), ("rounded", "16px")] {
            let mut p = params("text-box");
            p.border_radius = input.to_string();
            let html = render_template(&p).unwrap();
            assert!(html.contains(&format!("border-radius: {px}")), "{input} should map to {px}");
        }
    }

    #[test]
    fn animations_can_be_disabled() {
        let mut p = params("lower-third");
        p.animations_enabled = false;
        let html = render_template(&p).unwrap();
        assert!(!html.contains("overlay-pop-in"));
    }

    #[test]
    fn goal_bar_renders_fill_and_current_bound_to_source() {
        let mut p = params("goal-bar");
        p.goal = Some(1000.0);
        p.subtitle = BoundField { text: String::new(), source: "followers".to_string() };
        let html = render_template(&p).unwrap();
        assert!(html.contains(r#"data-bind-width="followers""#));
        assert!(html.contains(r#"data-goal="1000""#));
        assert!(html.contains(r#"data-bind="followers""#));
        assert!(html.contains(">1000</span>"), "should show the goal total as a whole number");
    }

    #[test]
    fn goal_bar_without_binding_still_renders_safely() {
        let mut p = params("goal-bar");
        p.goal = None;
        p.subtitle = BoundField::default();
        let html = render_template(&p).unwrap();
        assert!(!html.contains("data-bind-width"));
        assert!(html.contains(">100</span>"), "should fall back to a default goal of 100");
    }

    #[test]
    fn cam_frame_renders_border_and_hides_badge_without_a_label() {
        let mut p = params("cam-frame");
        p.title = BoundField::default();
        let html = render_template(&p).unwrap();
        assert!(html.contains("id=\"frame\""));
        assert!(!html.contains("id=\"card\""), "no label text/binding means no badge");
    }

    #[test]
    fn cam_frame_shows_badge_when_label_present() {
        let p = params("cam-frame"); // default title text is "Hello <World>"
        let html = render_template(&p).unwrap();
        assert!(html.contains("id=\"card\""));
    }

    #[test]
    fn text_shadow_and_stroke_are_opt_in() {
        let mut p = params("lower-third");
        let plain = render_template(&p).unwrap();
        assert!(!plain.contains("text-shadow"));
        assert!(!plain.contains("text-stroke"));

        p.text_shadow = true;
        p.text_stroke = true;
        let styled = render_template(&p).unwrap();
        assert!(styled.contains("text-shadow"));
        assert!(styled.contains("-webkit-text-stroke"));
    }

    #[test]
    fn create_then_load_then_update_round_trips_without_touching_other_overlays() {
        let dir = std::env::temp_dir().join(format!("sf-overlay-roundtrip-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        // Two independent overlays, saved side by side.
        let a = params("lower-third");
        let html_a = render_template(&a).unwrap();
        std::fs::write(dir.join("overlay-a.html"), &html_a).unwrap();
        write_params_sidecar(&dir, "overlay-a.html", &a).unwrap();

        let mut b = params("corner-badge");
        b.title = BoundField { text: "Overlay B".to_string(), source: String::new() };
        let html_b = render_template(&b).unwrap();
        std::fs::write(dir.join("overlay-b.html"), &html_b).unwrap();
        write_params_sidecar(&dir, "overlay-b.html", &b).unwrap();

        // Loading A's sidecar back gives A's own settings, not B's.
        let loaded_json = std::fs::read_to_string(params_sidecar_path(&dir, "overlay-a.html")).unwrap();
        let loaded: TemplateParams = serde_json::from_str(&loaded_json).unwrap();
        assert_eq!(loaded.template, "lower-third");

        // "Editing" A (re-render + overwrite the sidecar for A specifically)
        // must never touch B's files on disk.
        let b_html_before = std::fs::read_to_string(dir.join("overlay-b.html")).unwrap();
        let mut edited_a = loaded;
        edited_a.text_color = "#00ff00".to_string();
        let new_html_a = render_template(&edited_a).unwrap();
        std::fs::write(dir.join("overlay-a.html"), &new_html_a).unwrap();
        write_params_sidecar(&dir, "overlay-a.html", &edited_a).unwrap();

        let b_html_after = std::fs::read_to_string(dir.join("overlay-b.html")).unwrap();
        assert_eq!(b_html_before, b_html_after, "editing overlay A must not change overlay B's file");
        assert!(new_html_a.contains("#00ff00"));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn list_marks_maker_built_overlays_editable_and_uploads_not() {
        let dir = std::env::temp_dir().join(format!("sf-overlay-editable-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("made.html"), "<html></html>").unwrap();
        write_params_sidecar(&dir, "made.html", &params("lower-third")).unwrap();
        std::fs::write(dir.join("uploaded.png"), [0u8; 4]).unwrap();

        assert!(params_sidecar_path(&dir, "made.html").exists());
        assert!(!params_sidecar_path(&dir, "uploaded.png").exists());

        std::fs::remove_dir_all(&dir).ok();
    }
}
