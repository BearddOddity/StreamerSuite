// Overlay Library — a central directory of every browser-source overlay
// StreamerSuite can serve, all through StatusForge's existing widget/OAuth
// server (127.0.0.1:53735) rather than a second server:
//   - built-in: the widget HTML files already bundled under widgets/
//   - alerts: the new live Alerts Hub overlay (see server.rs's alert
//     broadcast + widgets/alerts-overlay.html)
//   - custom: user-added files, copied into overlays/custom/ under the
//     app's base directory and served by server.rs's custom_overlay_handler
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

fn stem_of(html_file: &str) -> &str {
    html_file.strip_suffix(".html").unwrap_or(html_file)
}

/// Where an overlay's version snapshots live — one subfolder per overlay
/// (keyed by its stem) under a hidden `.history` folder, so a rename never
/// disturbs its history (renames only touch the display-names map, never
/// the underlying file/stem) and removing the overlay can delete its whole
/// history in one `remove_dir_all`.
fn history_dir(dir: &std::path::Path, stem: &str) -> std::path::PathBuf {
    dir.join(".history").join(stem)
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

/// Display-name overrides live in their own tiny file, entirely separate
/// from the overlay's actual filename — so renaming an overlay never
/// touches its .html file or `.overlay.json`/`.canvas.json` sidecar, which
/// means the Browser Source URL already pasted into OBS (built from the
/// filename) keeps working across a rename.
fn names_map_path(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join(".display_names.json")
}

fn load_names_map(dir: &std::path::Path) -> HashMap<String, String> {
    std::fs::read_to_string(names_map_path(dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_names_map(dir: &std::path::Path, map: &HashMap<String, String>) -> Result<(), String> {
    let json = serde_json::to_string(map).map_err(|e| format!("couldn't serialize overlay names: {e}"))?;
    std::fs::write(names_map_path(dir), json).map_err(|e| format!("couldn't write overlay names: {e}"))
}

/// Sets (or, given an empty/whitespace-only name, clears) a display-name
/// override for a custom overlay. Purely cosmetic — never renames the
/// underlying file, so it can't collide with or affect any other overlay.
#[tauri::command]
pub(crate) fn overlay_rename_custom(file: String, name: String) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    if !dir.join(&file).exists() {
        return Err("overlay not found".into());
    }
    let mut map = load_names_map(&dir);
    let trimmed = name.trim();
    if trimmed.is_empty() {
        map.remove(&file);
    } else {
        map.insert(file, trimmed.chars().take(80).collect());
    }
    save_names_map(&dir, &map)
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
    let names = load_names_map(&dir);
    let mut entries = Vec::new();
    let read = std::fs::read_dir(&dir).map_err(|e| format!("couldn't read overlays/custom: {e}"))?;
    for entry in read.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.ends_with(".overlay.json") || file_name.ends_with(".canvas.json") || file_name.starts_with('.') {
            continue; // a settings sidecar, the names map, or the history dir — not an overlay file itself
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
        let name = names.get(&file_name).cloned().unwrap_or_else(|| humanize(&file_name));
        entries.push(OverlayEntry { name, file: file_name, editable, kind });
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
    let _ = std::fs::remove_dir_all(history_dir(&dir, stem_of(&file)));
    let mut names = load_names_map(&dir);
    if names.remove(&file).is_some() {
        let _ = save_names_map(&dir, &names);
    }
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
    /// A user-uploaded font file, embedded as a data URI — takes priority
    /// over `font_family` (the Google Fonts picker) when set, since a
    /// custom upload is a deliberate override of the preset list.
    #[serde(default)]
    custom_font_data_uri: Option<String>,
    #[serde(default)]
    custom_font_name: String,
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
    /// "template" (the default, absent on every element saved before
    /// free-form primitives existed) or one of the primitive shapes —
    /// `rect`/`ellipse`/`line`/`text`/`image`. Drives which of `params`
    /// (template) or `primitive` (shape) render_canvas actually reads.
    #[serde(default)]
    kind: Option<String>,
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
    /// Degrees, any kind — applied as a CSS transform on the element's own
    /// iframe wrapper in render_canvas, so it never has to be understood by
    /// render_template/render_primitive themselves.
    #[serde(default)]
    rotation: f32,
    /// Editor-only bookkeeping — never affects the rendered HTML, just
    /// whether the Canvas Maker lets this element be dragged/resized and
    /// whether it moves together with other elements sharing its `group_id`.
    #[serde(default)]
    locked: bool,
    #[serde(default)]
    group_id: Option<String>,
    /// Used when `kind` is "template" (or absent) — unused-but-present for
    /// primitive elements too, so a mixed canvas round-trips through any
    /// code path that still assumes every element has a full `params`.
    /// (No `#[serde(default)]` here — TemplateParams isn't Default, and
    /// every element, primitive or not, already carries a full one from
    /// the frontend.)
    params: TemplateParams,
    /// Used when `kind` is a primitive shape; absent/ignored for templates.
    #[serde(default)]
    primitive: Option<PrimitiveParams>,
}

/// A free-form shape/text/image layer — the non-template element kinds.
/// Every field has a serde default so an element that predates a given
/// field (or a hand-edited/AI-generated one missing fields) still renders
/// something reasonable instead of failing to parse.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PrimitiveParams {
    #[serde(default = "default_accent_color")]
    fill: String,
    #[serde(default = "default_one_f32")]
    fill_opacity: f32,
    /// "solid" / "linear" / "radial" — linear/radial blend `fill` into
    /// `fill_color2`, a 2-stop gradient (not full multi-stop editing).
    #[serde(default = "default_fill_type")]
    fill_type: String,
    #[serde(default = "default_fill_color2")]
    fill_color2: String,
    #[serde(default = "default_gradient_angle")]
    gradient_angle: f32,
    #[serde(default = "default_transparent")]
    stroke: String,
    #[serde(default)]
    stroke_width: f32,
    #[serde(default)]
    corner_radius: f32,
    #[serde(default = "default_one_f32")]
    opacity: f32,
    /// A CSS mix-blend-mode name — validated against an allowlist before
    /// ever reaching generated CSS (see `safe_blend_mode`).
    #[serde(default = "default_blend_mode")]
    blend_mode: String,
    #[serde(default)]
    shadow: bool,
    #[serde(default = "default_shadow_color")]
    shadow_color: String,
    #[serde(default = "default_shadow_blur")]
    shadow_blur: f32,
    #[serde(default)]
    shadow_offset_x: f32,
    #[serde(default = "default_shadow_offset_y")]
    shadow_offset_y: f32,
    /// Text kind only.
    #[serde(default)]
    text: String,
    #[serde(default)]
    font_family: String,
    #[serde(default = "default_font_size")]
    font_size: f32,
    #[serde(default = "default_font_weight")]
    font_weight: u32,
    #[serde(default = "default_text_color")]
    text_color: String,
    #[serde(default = "default_text_align")]
    text_align: String,
    /// Image kind only.
    #[serde(default)]
    image_data_uri: Option<String>,
    #[serde(default = "default_object_fit")]
    object_fit: String,
}

impl Default for PrimitiveParams {
    fn default() -> Self {
        PrimitiveParams {
            fill: default_accent_color(),
            fill_opacity: default_one_f32(),
            fill_type: default_fill_type(),
            fill_color2: default_fill_color2(),
            gradient_angle: default_gradient_angle(),
            stroke: default_transparent(),
            stroke_width: 0.0,
            corner_radius: 0.0,
            opacity: default_one_f32(),
            blend_mode: default_blend_mode(),
            shadow: false,
            shadow_color: default_shadow_color(),
            shadow_blur: default_shadow_blur(),
            shadow_offset_x: 0.0,
            shadow_offset_y: default_shadow_offset_y(),
            text: String::new(),
            font_family: String::new(),
            font_size: default_font_size(),
            font_weight: default_font_weight(),
            text_color: default_text_color(),
            text_align: default_text_align(),
            image_data_uri: None,
            object_fit: default_object_fit(),
        }
    }
}

fn default_one_f32() -> f32 {
    1.0
}
fn default_transparent() -> String {
    "transparent".into()
}
fn default_fill_type() -> String {
    "solid".into()
}
fn default_fill_color2() -> String {
    "#43e5e5".into()
}
fn default_gradient_angle() -> f32 {
    90.0
}
fn default_blend_mode() -> String {
    "normal".into()
}
const VALID_BLEND_MODES: &[&str] = &[
    "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "difference",
    "exclusion", "hue", "saturation", "color", "luminosity",
];
/// Only a known CSS mix-blend-mode keyword is accepted — falls back to
/// "normal" for anything else, same "reject silently, don't fail the
/// render" convention as `safe_color`.
fn safe_blend_mode(input: &str) -> &'static str {
    VALID_BLEND_MODES.iter().find(|&&m| m == input).copied().unwrap_or("normal")
}
fn default_shadow_color() -> String {
    "#000000".into()
}
fn default_shadow_blur() -> f32 {
    12.0
}
fn default_shadow_offset_y() -> f32 {
    4.0
}
fn default_font_size() -> f32 {
    48.0
}
fn default_font_weight() -> u32 {
    700
}
fn default_text_align() -> String {
    "left".into()
}
fn default_object_fit() -> String {
    "contain".into()
}

/// Editor-only sizing hint — render_canvas itself is fully percent-based and
/// doesn't care about absolute pixel dimensions at all (an OBS Browser
/// Source can be any resolution regardless of what's saved here). This just
/// lets the Canvas Maker remember and restore the aspect ratio a canvas was
/// designed for (16:9, vertical 9:16, square, or a custom size) instead of
/// always assuming 1920x1080.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CanvasParams {
    #[serde(default)]
    elements: Vec<CanvasElement>,
    #[serde(default = "default_canvas_width")]
    width: u32,
    #[serde(default = "default_canvas_height")]
    height: u32,
}

impl Default for CanvasParams {
    fn default() -> Self {
        CanvasParams { elements: Vec::new(), width: default_canvas_width(), height: default_canvas_height() }
    }
}

fn default_canvas_width() -> u32 {
    1920
}
fn default_canvas_height() -> u32 {
    1080
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
// Lower than it used to be (was 0.85) — glassmorphism reads as glass only
// when there's something to blur through; a near-opaque card hides the
// backdrop-filter almost entirely and just looks like a plain dark box.
fn default_bg_opacity() -> f32 {
    0.5
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

/// Same hex-only validation as `safe_color`, but also accepts the literal
/// "transparent" — needed for primitive shapes' fill/stroke, which default
/// to no fill/no stroke rather than a specific color.
fn safe_color_or_transparent(input: &str) -> String {
    if input == "transparent" {
        return input.to_string();
    }
    safe_color(input, "transparent")
}

/// Only a `data:` URI is accepted for an uploaded font — most browsers/OSes
/// report font files as `font/*`, `application/font-*`, or the generic
/// `application/octet-stream`, so the check is on the scheme, not a narrow
/// MIME allowlist. Capped well above any real font file to keep a malformed
/// or huge upload from bloating every saved overlay HTML.
fn safe_font_data_uri(input: &Option<String>) -> Option<String> {
    input
        .as_ref()
        .filter(|s| s.starts_with("data:") && s.len() < 5_000_000)
        .cloned()
}

/// Same character allowlist as `safe_font_family` — this becomes a CSS
/// `@font-face` family name, so it's sanitized the same way.
fn safe_font_name(input: &str, fallback: &str) -> String {
    safe_font_family(input).unwrap_or_else(|| fallback.to_string())
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
  // Representative stand-ins so a bound field never looks empty/broken while
  // being designed — only used when there's no overlay token (i.e. this
  // page isn't loaded from a real /forge-overlay or /custom-overlay URL,
  // which is exactly the Maker's own live preview). A real OBS browser
  // source always has a token and gets real data over the WebSocket below.
  var SAMPLE_DATA = {
    viewers: 128, followers: 1234, subscribers: 42, uptime: 5425, timer: 754,
    scene: "Just Chatting", latest_chat: "GG that was awesome!",
    now_playing_sound: "Airhorn", stream_title: "Chill stream, come hang out",
    stream_category: "Just Chatting", latest_alert: "TestViewer just followed!",
    cohost_reply: "Thanks for stopping by!"
  };
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
    // live preview, which renders via srcDoc and has no such URL) — show
    // sample values once instead of opening a WebSocket the server would
    // reject, so the preview never looks broken/empty while designing.
    if (!token) { apply(SAMPLE_DATA); return; }
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

/// Shared polling/render logic for the StatusForge "Now Playing" family
/// (Horizontal Left/Right, Vertical, Info Box — ported from the original
/// widgets/overlay-runtime.js). One deliberate change from that file: token
/// lookup goes through the shared `getOverlayToken()` (see
/// `TOKEN_FROM_PATH_JS`, always emitted right before this) instead of that
/// file's own narrower copy, since a Maker-built overlay is served from
/// `/custom-overlay/...` — or has no real URL at all inside a Canvas
/// element's `srcdoc` iframe — neither of which the original's
/// forge-overlay/forge-widget-only lookup recognizes. A missing token
/// (exactly the Editor's own live-preview case) shows the offline
/// placeholder immediately instead of leaving the card blank. The offline
/// fallback's icon comes from `/forge-overlay/<token>/icon.png` — an
/// absolute, cross-directory URL — since a Maker-built overlay's own
/// directory (`overlays/custom/`) has no `icon.png` of its own the way
/// `widgets/` does.
fn now_playing_script(has_cover: bool, offline_icon_size: &str, offline_icon_pos: &str) -> String {
    format!(
        r##"<script>
(function() {{
  var hasCover = {has_cover};
  var offlineIcon = {{ size: "{offline_icon_size}", position: "{offline_icon_pos}" }};
  function smoothTextUpdate(id, text) {{
    var el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = 0;
    setTimeout(function() {{ el.innerText = text; el.style.opacity = 1; }}, 500);
  }}
  function applyCoverArt(url) {{
    var cover = document.getElementById("a");
    if (!cover) return;
    cover.style.opacity = 0;
    setTimeout(function() {{
      cover.style.backgroundSize = "cover";
      cover.style.backgroundPosition = "center";
      cover.style.backgroundRepeat = "no-repeat";
      if (url) {{ cover.style.backgroundImage = "url(" + url + ")"; cover.style.backgroundColor = "#111"; }}
      else {{ cover.style.backgroundImage = "none"; cover.style.backgroundColor = "#050505"; }}
      cover.style.opacity = 1;
    }}, 500);
  }}
  var lastGame = "", sessionInterval = null, titleShownAt = 0, startTime = 0, pollRate = 3000;
  function updateTimer() {{
    if (!startTime) return;
    var diff = Math.floor(Date.now() / 1000) - Math.floor(startTime);
    if (diff < 0) return;
    var h = String(Math.floor(diff / 3600)).padStart(2, "0");
    var m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    var s = String(diff % 60).padStart(2, "0");
    var el = document.getElementById("s");
    if (el) el.innerText = h + ":" + m + ":" + s;
  }}
  function showOffline() {{
    if (lastGame) return;
    lastGame = "__offline__";
    var w = document.getElementById("w");
    w.style.opacity = "1";
    document.getElementById("t").innerText = "StatusForge";
    document.getElementById("r").innerText = "-";
    document.getElementById("g").innerText = "OFFLINE";
    document.getElementById("p").innerText = "ENGINE DISCONNECTED";
    if (hasCover) {{
      var token = getOverlayToken();
      var cover = document.getElementById("a");
      cover.style.backgroundImage = "url('http://127.0.0.1:53735/forge-overlay/" + encodeURIComponent(token) + "/icon.png')";
      cover.style.backgroundSize = offlineIcon.size;
      cover.style.backgroundRepeat = "no-repeat";
      cover.style.backgroundPosition = offlineIcon.position;
      cover.style.backgroundColor = "#1a1a2e";
    }}
  }}
  function pollEngine() {{
    var token = getOverlayToken();
    if (!token) {{ showOffline(); return; }}
    fetch("http://127.0.0.1:53735/status?nocache=" + Date.now() + "&token=" + encodeURIComponent(token))
      .then(function(r) {{ return r.json(); }})
      .then(function(data) {{
        var w = document.getElementById("w");
        if (data.is_playing) {{
          startTime = data.start_time;
          if (!sessionInterval) sessionInterval = setInterval(updateTimer, 1000);
          if (data.game_title !== lastGame) {{
            lastGame = data.game_title;
            titleShownAt = Date.now();
            smoothTextUpdate("t", data.game_title);
            smoothTextUpdate("r", data.release_date || "UNKNOWN");
            smoothTextUpdate("g", data.genre || "GAMING");
            smoothTextUpdate("p", data.publisher || "INDIE / UNKNOWN");
            if (hasCover) applyCoverArt(data.cover_url || "");
          }}
          if (data.fade_timer > 0) {{
            var elapsed = (Date.now() - titleShownAt) / 1000;
            w.style.opacity = elapsed >= data.fade_timer ? "0" : "1";
          }} else {{
            w.style.opacity = "1";
          }}
        }} else {{
          w.style.opacity = "0";
          lastGame = "";
          clearInterval(sessionInterval);
          sessionInterval = null;
        }}
      }})
      .catch(function() {{}});
  }}
  function initialize() {{
    var token = getOverlayToken();
    if (!token) {{ setTimeout(showOffline, 300); return; }}
    fetch("http://127.0.0.1:53735/settings?nocache=" + Date.now() + "&token=" + encodeURIComponent(token))
      .then(function(r) {{ return r.json(); }})
      .then(function(j) {{ pollRate = (j.overlay_poll_rate || 3) * 1000; }})
      .catch(function() {{}})
      .then(function() {{
        setInterval(pollEngine, pollRate);
        pollEngine();
      }});
  }}
  setTimeout(showOffline, 1500);
  initialize();
}})();
</script>"##,
        has_cover = has_cover,
        offline_icon_size = offline_icon_size,
        offline_icon_pos = offline_icon_pos,
    )
}

/// Ported from widgets/Logo.html: fades in the current game's `logo_url`
/// from StatusForge's `/status`. A game with no logo of its own hides the
/// card entirely rather than showing a placeholder (a substitute icon would
/// look like a broken asset, not "no logo available") — that's distinct
/// from the "nothing running at all" offline state, which shows a dimmed
/// app icon instead, same distinction the original makes.
fn game_logo_script() -> String {
    r#"<script>
(function() {
  var lastGame = "", titleShownAt = 0, hasLogo = false, pollRate = 3000;
  function showOfflineIcon() {
    var token = getOverlayToken();
    var logo = document.getElementById("lg");
    var w = document.getElementById("w");
    logo.classList.remove("visible");
    logo.classList.add("offline-icon");
    logo.src = "http://127.0.0.1:53735/forge-overlay/" + encodeURIComponent(token) + "/icon.png";
    logo.classList.add("visible");
    w.style.opacity = "1";
  }
  function pollEngine() {
    var token = getOverlayToken();
    if (!token) return;
    fetch("http://127.0.0.1:53735/status?nocache=" + Date.now() + "&token=" + encodeURIComponent(token))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var w = document.getElementById("w");
        var logo = document.getElementById("lg");
        if (data.is_playing) {
          if (data.game_title !== lastGame) {
            lastGame = data.game_title;
            titleShownAt = Date.now();
            hasLogo = !!data.logo_url;
            if (hasLogo) {
              logo.classList.remove("visible", "offline-icon");
              setTimeout(function() { logo.src = data.logo_url; logo.classList.add("visible"); }, 300);
            }
          }
          if (!hasLogo) {
            w.style.opacity = "0";
          } else if (data.fade_timer > 0) {
            var elapsed = (Date.now() - titleShownAt) / 1000;
            w.style.opacity = elapsed >= data.fade_timer ? "0" : "1";
          } else {
            w.style.opacity = "1";
          }
        } else {
          w.style.opacity = "0";
          lastGame = "";
        }
      })
      .catch(function() {});
  }
  function initialize() {
    var token = getOverlayToken();
    if (!token) { setTimeout(showOfflineIcon, 300); return; }
    fetch("http://127.0.0.1:53735/settings?nocache=" + Date.now() + "&token=" + encodeURIComponent(token))
      .then(function(r) { return r.json(); })
      .then(function(j) { pollRate = (j.overlay_poll_rate || 3) * 1000; })
      .catch(function() {})
      .then(function() {
        setInterval(pollEngine, pollRate);
        pollEngine();
      });
  }
  setTimeout(function() { if (!lastGame) showOfflineIcon(); }, 1500);
  initialize();
})();
</script>"#
        .to_string()
}

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
    let custom_font_uri = safe_font_data_uri(&params.custom_font_data_uri);
    let font_family = safe_font_family(&params.font_family);
    // The "Now Playing" card replicates a fixed StatusForge design that
    // always uses Montserrat — loaded via a <link> (not a CSS @import,
    // which the generic wrapper below can't put first in the stylesheet)
    // regardless of whatever's in the (hidden, for this template) font
    // fields.
    let (font_css, font_link, font_face_css) = if params.template == "now-playing" {
        (
            "\"Montserrat\", sans-serif".to_string(),
            r#"<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800;900&display=swap">"#
                .to_string(),
            String::new(),
        )
    } else if let Some(uri) = &custom_font_uri {
        let name = safe_font_name(&params.custom_font_name, "CustomOverlayFont");
        (
            format!("\"{name}\", {FONT_STACK}"),
            String::new(),
            format!("@font-face {{ font-family: \"{name}\"; src: url({uri}); font-display: swap; }}"),
        )
    } else {
        let css = font_family
            .as_ref()
            .map(|f| format!("\"{f}\", {FONT_STACK}"))
            .unwrap_or_else(|| FONT_STACK.to_string());
        let link = font_family
            .as_ref()
            .map(|f| {
                let query = f.replace(' ', "+");
                format!(
                    r#"<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={query}:wght@400;500;700;800&display=swap">"#
                )
            })
            .unwrap_or_default();
        (css, link, String::new())
    };

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
                    "#card {{ display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06); {card_animation} }}\n\
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
                    "#card {{ display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 999px; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid {accent}; box-shadow: 0 0 20px {accent}55, inset 0 1px 0 rgba(255, 255, 255, 0.06); {card_animation} }}\n\
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
                    "#bar {{ width: 100%; overflow: hidden; padding: 10px 0; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 2px solid {accent}; border-bottom: 2px solid {accent}; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06); }}\n\
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
                    "#card {{ display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 40px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid {accent}; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06); text-align: center; {card_animation} }}\n\
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
                    "#card {{ display: flex; flex-direction: column; gap: 8px; padding: 16px 22px; min-width: 280px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid {accent}; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06); {card_animation} }}\n\
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
                     #card {{ display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid {accent}; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06); {card_animation} }}\n\
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
                    "#card {{ position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 22px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid {accent}; box-shadow: 0 0 24px {accent}88, inset 0 1px 0 rgba(255, 255, 255, 0.06); {card_animation} }}\n\
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
                    "#card {{ display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 36px; border-radius: {radius}; background: rgba(5, 5, 5, {bg_opacity}); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid {accent}; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06); text-align: center; {card_animation} }}\n\
                     .title {{ font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: {text_color}; opacity: 0.8; }}\n\
                     .countdown {{ font-size: 40px; font-weight: 800; color: {text_color}; font-variant-numeric: tabular-nums; }}\n\
                     .subtitle {{ font-size: 14px; color: {text_color}; opacity: 0.7; }}\n\
                     {keyframes}"
                ),
            )
        }
        // Replicates the original widgets/{Horizontal_Left,Horizontal_Right,
        // Vertical,Info_Box}.html pixel-for-pixel — a fixed StatusForge
        // design (metallic gradient text, glass info card, sliding stat
        // carousel), not a themeable one, so unlike every arm above it
        // ignores text_color/accent_color/bg_opacity/border_radius/logo
        // entirely (those fields are hidden for this template in the
        // frontend) and drives everything from `position` instead.
        "now-playing" if params.position == "compact" => (
            String::new(),
            r#"<div class="widget-container" id="w"><div class="info-box"><div class="info-content"><div class="cover-thumb" id="a"></div><div class="info-text"><div id="t" class="metallic-text game-title">...</div><div class="slider-stage"><div class="slider-track"><div class="slide-item"><span class="label-text">Released</span><span id="r" class="metallic-text data-text">...</span></div><div class="slide-item"><span class="label-text">Genre</span><span id="g" class="metallic-text data-text">...</span></div><div class="slide-item"><span class="label-text">Publisher</span><span id="p" class="metallic-text data-text">...</span></div><div class="slide-item"><span class="label-text">Session</span><span id="s" class="metallic-text data-text">00:00:00</span></div></div></div></div></div></div>"#
                .to_string(),
            "body { display: flex; justify-content: center; align-items: center; }\n\
             .widget-container { width: 620px; display: flex; justify-content: center; align-items: center; position: relative; opacity: 0; transition: opacity 1s ease-in-out; }\n\
             .info-box { width: 100%; min-height: 210px; position: relative; border-radius: 35px; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 10px 10px 30px rgba(0,0,0,0.6); overflow: hidden; }\n\
             .info-content { position: relative; padding: 20px; display: flex; flex-direction: row; align-items: center; gap: 20px; }\n\
             .cover-thumb { width: 127px; height: 173px; flex-shrink: 0; border-radius: 16px; background-size: cover; background-position: center; background-color: #111; box-shadow: 6px 6px 20px rgba(0,0,0,0.5); position: relative; overflow: hidden; }\n\
             .cover-thumb::after { content: \"\"; position: absolute; top: -50%; left: -60%; width: 30%; height: 200%; background: rgba(255, 255, 255, 0.15); transform: rotate(35deg); animation: glossShine 7s infinite ease-in-out; }\n\
             @keyframes glossShine { 0% { left: -100%; } 15% { left: 150%; } 100% { left: 150%; } }\n\
             .info-text { flex: 1; min-width: 0; text-align: left; display: flex; flex-direction: column; justify-content: center; }\n\
             .metallic-text { background: linear-gradient(to bottom, #ffffff 0%, #dcdcdc 50%, #ffffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.8)); display: inline-block; }\n\
             .game-title { font-weight: 900; margin-bottom: 8px; line-height: 1.1; font-size: 24px; letter-spacing: -0.5px; word-wrap: break-word; }\n\
             .slider-stage { position: relative; height: 60px; overflow: hidden; width: 100%; }\n\
             .slider-track { position: absolute; width: 100%; animation: slideData 16s infinite ease-in-out; }\n\
             @keyframes slideData { 0%, 20% { transform: translateY(0); } 25%, 45% { transform: translateY(-60px); } 50%, 70% { transform: translateY(-120px); } 75%, 95% { transform: translateY(-180px); } 100% { transform: translateY(0); } }\n\
             .slide-item { height: 60px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }\n\
             .label-text { font-weight: 800; text-transform: uppercase; letter-spacing: 2px; font-size: 13px; margin-bottom: 2px; color: rgba(255, 255, 255, 0.4); }\n\
             .data-text { font-weight: 800; font-size: 19px; line-height: 1.1; }"
                .to_string(),
        ),
        "now-playing" => {
            let (body_align, container_css, cover_html, info_box_css, info_content_css) = match params.position.as_str() {
                "horizontal-right" => (
                    "center",
                    "width: 850px; flex-direction: row-reverse; align-items: flex-end;",
                    r#"<div class="game-art" id="a"></div>"#,
                    "width: 520px; min-height: 180px; margin-right: -100px; margin-bottom: 30px; border-radius: 35px; background: rgba(0, 0, 0, 0.65);",
                    "padding: 25px 120px 25px 40px; text-align: right;",
                ),
                "vertical" => (
                    "start",
                    "width: 360px; flex-direction: column; align-items: center; margin-top: 25px;",
                    r#"<div class="game-art" id="a" style="width: 360px; height: 450px;"></div>"#,
                    "width: 360px; min-height: 180px; margin-top: -60px; border-radius: 40px; background: rgba(0, 0, 0, 0.65); padding-top: 60px;",
                    "padding: 30px 20px 40px 20px; text-align: center;",
                ),
                "info-only" => (
                    "center",
                    "width: 560px; align-items: center;",
                    "",
                    "width: 100%; min-height: 180px; border-radius: 35px; background: rgba(0, 0, 0, 0.6);",
                    "padding: 25px 40px; text-align: left;",
                ),
                _ => (
                    "center",
                    "width: 850px; flex-direction: row; align-items: flex-end;",
                    r#"<div class="game-art" id="a"></div>"#,
                    "width: 520px; min-height: 180px; margin-left: -100px; margin-bottom: 30px; border-radius: 35px; background: rgba(0, 0, 0, 0.6);",
                    "padding: 25px 40px 25px 120px; text-align: left;",
                ),
            };
            (
                String::new(),
                format!(
                    r#"<div class="widget-container" id="w">{cover_html}<div class="info-box"><div class="info-content"><div id="t" class="metallic-text game-title">...</div><div class="slider-stage"><div class="slider-track"><div class="slide-item"><span class="label-text">Released</span><span id="r" class="metallic-text data-text">...</span></div><div class="slide-item"><span class="label-text">Genre</span><span id="g" class="metallic-text data-text">...</span></div><div class="slide-item"><span class="label-text">Publisher</span><span id="p" class="metallic-text data-text">...</span></div><div class="slide-item"><span class="label-text">Session</span><span id="s" class="metallic-text data-text">00:00:00</span></div></div></div></div></div>"#
                ),
                format!(
                    "body {{ display: flex; justify-content: center; align-items: {body_align}; }}\n\
                     .widget-container {{ display: flex; flex-direction: row; position: relative; opacity: 0; transition: opacity 1s ease-in-out; {container_css} }}\n\
                     .game-art {{ width: 330px; height: 450px; background-size: cover; background-position: center; border-radius: 60px; z-index: 3; position: relative; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 10px 10px 40px rgba(0,0,0,0.8); flex-shrink: 0; background-color: #111; }}\n\
                     .game-art::after {{ content: \"\"; position: absolute; top: -50%; left: -60%; width: 30%; height: 200%; background: rgba(255, 255, 255, 0.15); transform: rotate(35deg); animation: glossShine 7s infinite ease-in-out; }}\n\
                     @keyframes glossShine {{ 0% {{ left: -100%; }} 15% {{ left: 150%; }} 100% {{ left: 150%; }} }}\n\
                     .info-box {{ position: relative; z-index: 1; backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 10px 10px 30px rgba(0,0,0,0.6); overflow: hidden; {info_box_css} }}\n\
                     .info-content {{ position: relative; display: flex; flex-direction: column; justify-content: center; {info_content_css} }}\n\
                     .metallic-text {{ background: linear-gradient(to bottom, #ffffff 0%, #dcdcdc 50%, #ffffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.8)); display: inline-block; }}\n\
                     .game-title {{ font-weight: 900; margin-bottom: 8px; line-height: 1.1; font-size: 26px; letter-spacing: -0.5px; word-wrap: break-word; }}\n\
                     .slider-stage {{ position: relative; height: 60px; overflow: hidden; width: 100%; }}\n\
                     .slider-track {{ position: absolute; width: 100%; animation: slideData 16s infinite ease-in-out; }}\n\
                     @keyframes slideData {{ 0%, 20% {{ transform: translateY(0); }} 25%, 45% {{ transform: translateY(-60px); }} 50%, 70% {{ transform: translateY(-120px); }} 75%, 95% {{ transform: translateY(-180px); }} 100% {{ transform: translateY(0); }} }}\n\
                     .slide-item {{ height: 60px; display: flex; flex-direction: column; align-items: {info_align}; justify-content: center; }}\n\
                     .label-text {{ font-weight: 800; text-transform: uppercase; letter-spacing: 2px; font-size: 13px; margin-bottom: 2px; color: rgba(255, 255, 255, 0.5); }}\n\
                     .data-text {{ font-weight: 800; font-size: 19px; line-height: 1.1; }}",
                    info_align = if params.position == "horizontal-right" { "flex-end" } else if params.position == "vertical" { "center" } else { "flex-start" },
                ),
            )
        }
        "game-logo" => (
            String::new(),
            r#"<div class="widget-container" id="w"><div class="glow-panel"></div><div class="logo-stage"><img class="logo-img" id="lg" src="" alt="" onerror="this.onerror=null; this.classList.remove('visible'); document.getElementById('w').style.opacity='0';"></div></div>"#
                .to_string(),
            "body { display: flex; justify-content: center; align-items: center; }\n\
             .widget-container { width: 560px; height: 280px; display: flex; justify-content: center; align-items: center; position: relative; opacity: 0; transition: opacity 1s ease-in-out; }\n\
             .glow-panel { position: absolute; inset: 0; border-radius: 40px; background: radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0) 70%); backdrop-filter: blur(2px); }\n\
             .logo-stage { position: relative; width: 92%; height: 82%; display: flex; justify-content: center; align-items: center; }\n\
             .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0; transform: scale(0.94); transition: opacity 0.6s ease-in-out, transform 0.6s ease-in-out; filter: drop-shadow(0 0 40px rgba(0,0,0,0.55)) drop-shadow(0 12px 28px rgba(0,0,0,0.5)); }\n\
             .logo-img.visible { opacity: 1; transform: scale(1); }\n\
             .logo-img.offline-icon { max-width: 45%; max-height: 45%; opacity: 0.55; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.4)); }"
                .to_string(),
        ),
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
    if params.template == "now-playing" {
        let (has_cover, icon_size, icon_pos) = match params.position.as_str() {
            "info-only" => (false, "", ""),
            "compact" => (true, "84px 84px", "center"),
            _ => (true, "224px 224px", "center 40%"),
        };
        script.push_str(&format!("<script>{TOKEN_FROM_PATH_JS}</script>"));
        script.push_str(&now_playing_script(has_cover, icon_size, icon_pos));
    }
    if params.template == "game-logo" {
        script.push_str(&format!("<script>{TOKEN_FROM_PATH_JS}</script>"));
        script.push_str(&game_logo_script());
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
  {font_face_css}
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

/// A free-form shape/text/image layer — much simpler than render_template
/// since there's no position-preset/animation/font-upload system to thread
/// through, just the one shape's own fill/stroke/effects. Infallible (no
/// external call can fail here), unlike render_template.
fn render_primitive(kind: &str, p: &PrimitiveParams) -> String {
    let fill = safe_color_or_transparent(&p.fill);
    let fill_opacity = clamp01(p.fill_opacity);
    // 2-stop gradient (not full multi-stop editing, kept simple on purpose)
    // — "linear"/"radial" blend `fill` into `fill_color2`; anything else
    // (including an unrecognized fill_type) falls back to the solid color.
    let fill_css = match p.fill_type.as_str() {
        "linear" => {
            let color2 = safe_color_or_transparent(&p.fill_color2);
            let angle = p.gradient_angle.rem_euclid(360.0);
            format!("linear-gradient({angle}deg, {fill}, {color2})")
        }
        "radial" => {
            let color2 = safe_color_or_transparent(&p.fill_color2);
            format!("radial-gradient(circle, {fill}, {color2})")
        }
        _ => fill.clone(),
    };
    let stroke = safe_color_or_transparent(&p.stroke);
    let stroke_width = p.stroke_width.clamp(0.0, 60.0);
    let corner_radius = p.corner_radius.clamp(0.0, 500.0);
    let opacity = clamp01(p.opacity);
    let blend_mode = safe_blend_mode(&p.blend_mode);
    let blend_css = if blend_mode == "normal" { String::new() } else { format!("mix-blend-mode: {blend_mode};") };
    let shadow_css = if p.shadow {
        let color = safe_color(&p.shadow_color, "#000000");
        let blur = p.shadow_blur.clamp(0.0, 120.0);
        let ox = p.shadow_offset_x.clamp(-300.0, 300.0);
        let oy = p.shadow_offset_y.clamp(-300.0, 300.0);
        format!("filter: drop-shadow({ox}px {oy}px {blur}px {color});")
    } else {
        String::new()
    };

    let body = match kind {
        "ellipse" => format!(
            r#"<div style="width:100%; height:100%; box-sizing:border-box; background:{fill_css}; opacity:{fill_opacity}; border:{stroke_width}px solid {stroke}; border-radius:50%;"></div>"#
        ),
        "line" => format!(
            r#"<div style="width:100%; height:100%; background:{fill_css}; opacity:{fill_opacity};"></div>"#
        ),
        "text" => {
            let text_color = safe_color(&p.text_color, &default_text_color());
            let (text_align, justify) = match p.text_align.as_str() {
                "center" => ("center", "center"),
                "right" => ("right", "flex-end"),
                _ => ("left", "flex-start"),
            };
            let font_family = safe_font_family(&p.font_family)
                .map(|f| format!("\"{f}\", {FONT_STACK}"))
                .unwrap_or_else(|| FONT_STACK.to_string());
            let font_size = p.font_size.clamp(4.0, 400.0);
            let font_weight = p.font_weight.clamp(100, 900);
            let text = escape_html(&p.text).replace('\n', "<br>");
            format!(
                r#"<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:{justify}; text-align:{text_align}; color:{text_color}; font-family:{font_family}; font-size:{font_size}px; font-weight:{font_weight}; white-space:pre-wrap; word-break:break-word; overflow:hidden;">{text}</div>"#
            )
        }
        "image" => {
            let fit = match p.object_fit.as_str() {
                "cover" => "cover",
                "fill" => "fill",
                _ => "contain",
            };
            match safe_logo(&p.image_data_uri) {
                Some(src) => format!(r#"<img src="{src}" alt="" style="width:100%; height:100%; object-fit:{fit}; display:block;">"#),
                None => r#"<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.3); font-family:sans-serif; font-size:14px;">No image</div>"#.to_string(),
            }
        }
        // "rect" and any unrecognized kind (defensive — shouldn't happen,
        // render_canvas only calls this for a non-"template" kind).
        _ => format!(
            r#"<div style="width:100%; height:100%; box-sizing:border-box; background:{fill_css}; opacity:{fill_opacity}; border:{stroke_width}px solid {stroke}; border-radius:{corner_radius}px;"></div>"#
        ),
    };

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><style>html, body {{ margin: 0; padding: 0; background: transparent; overflow: hidden; }}</style></head>
<body>
<div style="width:100%; height:100%; opacity:{opacity}; {blend_css} {shadow_css}">{body}</div>
</body>
</html>
"#
    )
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
        let kind = el.kind.as_deref().unwrap_or("template");
        let inner_html = if kind == "template" {
            render_template(&el.params)?
        } else {
            let default_primitive = PrimitiveParams::default();
            render_primitive(kind, el.primitive.as_ref().unwrap_or(&default_primitive))
        };
        let x = el.x_pct.clamp(0.0, 100.0);
        let y = el.y_pct.clamp(0.0, 100.0);
        let w = el.width_pct.clamp(2.0, 100.0);
        let h = el.height_pct.clamp(2.0, 100.0);
        let z = el.z_index;
        // Rotation is applied here (on the iframe wrapper), not inside
        // render_template/render_primitive — a rotated template still
        // renders exactly like an unrotated one internally, it's just
        // spun as a whole around its own center.
        let rotation = el.rotation.clamp(-360.0, 360.0);
        let transform = if rotation != 0.0 {
            format!("transform: rotate({rotation}deg); transform-origin: center center;")
        } else {
            String::new()
        };
        let frame_id = format!("el-{i}");
        iframes.push_str(&format!(
            r#"<iframe id="{frame_id}" class="el" style="left:{x}%; top:{y}%; width:{w}%; height:{h}%; z-index:{z}; {transform}"></iframe>"#
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

// --- "Design with AI": generate a whole Canvas layout from a text prompt ---
// Same Hugging Face Inference Providers call as AI Co-Host (see cohost.rs) —
// no local runtime, just the token already stored in Connections & Keys.

const HF_ROUTER_URL: &str = "https://router.huggingface.co/v1/chat/completions";

const VALID_TEMPLATES: &[&str] = &[
    "lower-third", "corner-badge", "ticker", "text-box", "goal-bar", "cam-frame", "alert-banner", "countdown",
];

#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AiElementSpec {
    #[serde(default)]
    template: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    subtitle: String,
    #[serde(default)]
    text_color: String,
    #[serde(default)]
    accent_color: String,
    #[serde(default)]
    x_pct: f32,
    #[serde(default)]
    y_pct: f32,
    #[serde(default)]
    width_pct: f32,
    #[serde(default)]
    height_pct: f32,
}

/// Models sometimes wrap JSON in a ```json fenced block despite being told
/// not to — stripped defensively rather than failing the whole generation.
fn strip_json_fence(s: &str) -> &str {
    s.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
}

/// Turns model-provided (and therefore untrusted-for-bounds) specs into
/// real `CanvasElement`s — unknown template ids are dropped rather than
/// rendered, every numeric field is clamped to a sane range regardless of
/// what the model said, and text is length-capped. Everything else
/// (opacity, font, animation, effects) uses the same defaults a
/// human-built element would start from.
fn build_canvas_from_specs(specs: Vec<AiElementSpec>) -> Vec<CanvasElement> {
    specs
        .into_iter()
        .take(6)
        .enumerate()
        .filter(|(_, spec)| VALID_TEMPLATES.contains(&spec.template.as_str()))
        .map(|(i, spec)| CanvasElement {
            id: format!("ai-{i}"),
            kind: None,
            x_pct: spec.x_pct.clamp(0.0, 90.0),
            y_pct: spec.y_pct.clamp(0.0, 90.0),
            width_pct: if spec.width_pct <= 0.0 { 30.0 } else { spec.width_pct.clamp(10.0, 60.0) },
            height_pct: if spec.height_pct <= 0.0 { 20.0 } else { spec.height_pct.clamp(10.0, 50.0) },
            z_index: i as i32,
            rotation: 0.0,
            locked: false,
            group_id: None,
            primitive: None,
            params: TemplateParams {
                template: spec.template,
                title: BoundField { text: spec.title.chars().take(80).collect(), source: String::new() },
                subtitle: BoundField { text: spec.subtitle.chars().take(80).collect(), source: String::new() },
                text_color: safe_color(&spec.text_color, &default_text_color()),
                accent_color: safe_color(&spec.accent_color, &default_accent_color()),
                bg_opacity: default_bg_opacity(),
                position: String::new(),
                logo_data_uri: None,
                speed_seconds: None,
                font_family: String::new(),
                custom_font_data_uri: None,
                custom_font_name: String::new(),
                border_radius: default_border_radius(),
                animations_enabled: true,
                animation_style: default_animation_style(),
                goal: None,
                text_shadow: false,
                text_stroke: false,
                countdown_target: String::new(),
            },
        })
        .collect()
}

#[tauri::command]
pub(crate) async fn overlay_generate_canvas_from_prompt(prompt: String, model: String) -> Result<CanvasParams, String> {
    if prompt.trim().is_empty() {
        return Err("Describe what you want first".into());
    }
    let model = if model.trim().is_empty() { "meta-llama/Llama-3.1-8B-Instruct".to_string() } else { model };

    let base = crate::app_base_dir()?;
    let config = crate::auth::load_config_at(&base)?;
    let token = config.api_keys.huggingface.clone();
    if token.is_empty() {
        return Err("Connect a Hugging Face API token in Settings → Connections & Keys first".into());
    }

    let template_list = VALID_TEMPLATES.iter().map(|t| format!("\"{t}\"")).collect::<Vec<_>>().join(", ");
    let system_prompt = format!(
        "You design browser-source overlay layouts for a livestream. Output ONLY a JSON array \
         (no prose, no markdown fences), 2 to 4 items, each shaped exactly like: {{\"template\": \
         one of [{template_list}], \"title\": \"short text\", \"subtitle\": \"short text or empty\", \
         \"textColor\": \"#rrggbb\", \"accentColor\": \"#rrggbb\", \"xPct\": 0-90, \"yPct\": 0-90, \
         \"widthPct\": 15-45, \"heightPct\": 12-35}}. Keep elements from overlapping too much and \
         pick colors that match the requested mood."
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": prompt },
        ],
        "max_tokens": 800,
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

    let payload: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = payload["choices"]
        .get(0)
        .and_then(|c| c["message"]["content"].as_str())
        .ok_or("Hugging Face returned an unexpected response shape")?;

    let specs: Vec<AiElementSpec> = serde_json::from_str(strip_json_fence(content))
        .map_err(|e| format!("Couldn't parse the generated layout — try again or rephrase ({e})"))?;

    let elements = build_canvas_from_specs(specs);
    if elements.is_empty() {
        return Err("The model didn't return any usable elements — try again or rephrase".into());
    }

    Ok(CanvasParams { elements, width: default_canvas_width(), height: default_canvas_height() })
}

#[tauri::command]
pub(crate) fn overlay_preview_canvas(elements: Vec<CanvasElement>) -> Result<String, String> {
    render_canvas(&elements)
}

// --- Named version history / save-points ---
// A snapshot is whatever's currently saved on disk (the sidecar content, not
// the caller's in-flight edit) — so an "Auto-save" snapshot taken right
// before `overlay_update_template`/`overlay_update_canvas` overwrites always
// captures the last-saved-and-actually-working state, not a half-typed edit.

#[derive(Serialize, Deserialize)]
struct VersionEnvelope {
    kind: String,
    label: String,
    timestamp: i64,
    data: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct VersionInfo {
    id: String,
    label: String,
    timestamp: i64,
}

/// Auto-saves keep piling up on every edit — capped well past what anyone
/// would realistically scroll through, so the history stays useful without
/// growing unbounded. Named checkpoints count against the same cap; the
/// oldest entries (by timestamp, regardless of label) are pruned first.
const MAX_HISTORY_ENTRIES: usize = 30;

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn prune_history(hdir: &std::path::Path) {
    let Ok(read) = std::fs::read_dir(hdir) else { return };
    let mut entries: Vec<(std::path::PathBuf, i64)> = read
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            let json = std::fs::read_to_string(&path).ok()?;
            let env: VersionEnvelope = serde_json::from_str(&json).ok()?;
            Some((path, env.timestamp))
        })
        .collect();
    if entries.len() <= MAX_HISTORY_ENTRIES {
        return;
    }
    entries.sort_by_key(|(_, ts)| -*ts);
    for (path, _) in entries.into_iter().skip(MAX_HISTORY_ENTRIES) {
        let _ = std::fs::remove_file(path);
    }
}

/// Snapshots whatever's currently on disk for `file` (template or canvas,
/// whichever sidecar exists) into its history folder. `Ok(None)` when
/// there's nothing saved yet to snapshot (e.g. an update racing a create
/// that hasn't finished) rather than an error — a missed auto-snapshot
/// should never block the save it's guarding.
fn save_version_internal(dir: &std::path::Path, file: &str, label: &str) -> Result<Option<String>, String> {
    let (kind, data) = if canvas_sidecar_path(dir, file).exists() {
        let json = std::fs::read_to_string(canvas_sidecar_path(dir, file)).map_err(|e| e.to_string())?;
        ("canvas".to_string(), serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?)
    } else if params_sidecar_path(dir, file).exists() {
        let json = std::fs::read_to_string(params_sidecar_path(dir, file)).map_err(|e| e.to_string())?;
        ("template".to_string(), serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?)
    } else {
        return Ok(None);
    };
    let hdir = history_dir(dir, stem_of(file));
    std::fs::create_dir_all(&hdir).map_err(|e| format!("couldn't create version history folder: {e}"))?;
    let timestamp = now_millis();
    let label = if label.trim().is_empty() { "Checkpoint".to_string() } else { label.trim().chars().take(60).collect() };
    let envelope = VersionEnvelope { kind, label, timestamp, data };
    // Two snapshots landing in the same millisecond (e.g. a fast automated
    // test, or an auto-save immediately following a named checkpoint) must
    // still get distinct file names — a plain timestamp alone isn't
    // guaranteed unique.
    let mut id = format!("{timestamp}.json");
    let mut n = 2;
    while hdir.join(&id).exists() {
        id = format!("{timestamp}-{n}.json");
        n += 1;
    }
    let json = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;
    std::fs::write(hdir.join(&id), json).map_err(|e| format!("couldn't write version snapshot: {e}"))?;
    prune_history(&hdir);
    Ok(Some(id))
}

/// Saves an explicit, user-named checkpoint of the overlay's currently
/// *saved* state (not unsaved in-editor changes — save first, then
/// checkpoint) that `overlay_restore_version` can roll back to later.
#[tauri::command]
pub(crate) fn overlay_save_version(file: String, label: String) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    if save_version_internal(&dir, &file, &label)?.is_none() {
        return Err("overlay hasn't been saved yet".into());
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn overlay_list_versions(file: String) -> Result<Vec<VersionInfo>, String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    let hdir = history_dir(&dir, stem_of(&file));
    let mut versions: Vec<VersionInfo> = std::fs::read_dir(&hdir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let json = std::fs::read_to_string(e.path()).ok()?;
            let env: VersionEnvelope = serde_json::from_str(&json).ok()?;
            Some(VersionInfo { id: e.file_name().to_string_lossy().to_string(), label: env.label, timestamp: env.timestamp })
        })
        .collect();
    versions.sort_by_key(|v| -v.timestamp);
    Ok(versions)
}

/// Rolls `file` back to a prior snapshot — re-renders and overwrites the
/// live HTML plus its sidecar, exactly like a normal update, and takes a
/// safety snapshot of the state being replaced first (labeled distinctly)
/// so a restore is itself never a one-way trip.
#[tauri::command]
pub(crate) fn overlay_restore_version(file: String, version_id: String) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    if version_id.contains('/') || version_id.contains('\\') || version_id.contains("..") {
        return Err("invalid version id".into());
    }
    let dir = custom_overlays_dir()?;
    let dest = dir.join(&file);
    crate::assert_path_in_base(&dest, &dir)?;
    if !dest.exists() {
        return Err("overlay not found".into());
    }
    let hdir = history_dir(&dir, stem_of(&file));
    let version_path = hdir.join(&version_id);
    crate::assert_path_in_base(&version_path, &hdir)?;
    let json = std::fs::read_to_string(&version_path).map_err(|e| format!("couldn't read version snapshot: {e}"))?;
    let envelope: VersionEnvelope = serde_json::from_str(&json).map_err(|e| format!("couldn't parse version snapshot: {e}"))?;

    let _ = save_version_internal(&dir, &file, "Before restore");

    if envelope.kind == "canvas" {
        let canvas: CanvasParams = serde_json::from_value(envelope.data).map_err(|e| format!("couldn't parse version snapshot: {e}"))?;
        let html = render_canvas(&canvas.elements)?;
        std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
        write_canvas_sidecar(&dir, &file, &canvas)
    } else {
        let params: TemplateParams = serde_json::from_value(envelope.data).map_err(|e| format!("couldn't parse version snapshot: {e}"))?;
        let html = render_template(&params)?;
        std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
        write_params_sidecar(&dir, &file, &params)
    }
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
pub(crate) fn overlay_create_from_canvas(
    elements: Vec<CanvasElement>,
    canvas_width: Option<u32>,
    canvas_height: Option<u32>,
) -> Result<String, String> {
    let html = render_canvas(&elements)?;
    let dir = custom_overlays_dir()?;
    let title = elements.first().map(|e| e.params.title.text.clone()).unwrap_or_default();
    let slug = slugify(&title, "canvas");
    let file_name = unique_file_name(&dir, &slug);
    let dest = dir.join(&file_name);
    crate::assert_path_in_base(&dest, &dir)?;
    std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
    let width = canvas_width.unwrap_or_else(default_canvas_width).clamp(64, 8000);
    let height = canvas_height.unwrap_or_else(default_canvas_height).clamp(64, 8000);
    write_canvas_sidecar(&dir, &file_name, &CanvasParams { elements, width, height })?;
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
pub(crate) fn overlay_update_canvas(
    file: String,
    elements: Vec<CanvasElement>,
    canvas_width: Option<u32>,
    canvas_height: Option<u32>,
) -> Result<(), String> {
    if file.contains('/') || file.contains('\\') || file.contains("..") {
        return Err("invalid file name".into());
    }
    let dir = custom_overlays_dir()?;
    let dest = dir.join(&file);
    crate::assert_path_in_base(&dest, &dir)?;
    if !dest.exists() {
        return Err("overlay not found".into());
    }
    let _ = save_version_internal(&dir, &file, "Auto-save");
    let html = render_canvas(&elements)?;
    std::fs::write(&dest, html).map_err(|e| format!("couldn't write overlay: {e}"))?;
    let width = canvas_width.unwrap_or_else(default_canvas_width).clamp(64, 8000);
    let height = canvas_height.unwrap_or_else(default_canvas_height).clamp(64, 8000);
    write_canvas_sidecar(&dir, &file, &CanvasParams { elements, width, height })
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
    let _ = save_version_internal(&dir, &file, "Auto-save");
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
            custom_font_data_uri: None,
            custom_font_name: String::new(),
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
            kind: None,
            x_pct: x,
            y_pct: y,
            width_pct: 30.0,
            height_pct: 20.0,
            z_index: z,
            rotation: 0.0,
            locked: false,
            group_id: None,
            primitive: None,
            params: params(template),
        }
    }

    #[test]
    fn render_primitive_rect_uses_fill_stroke_and_corner_radius() {
        let p = PrimitiveParams { fill: "#ff0000".into(), fill_opacity: 0.5, stroke: "#00ff00".into(), stroke_width: 3.0, corner_radius: 12.0, ..Default::default() };
        let html = render_primitive("rect", &p);
        assert!(html.contains("background:#ff0000"));
        assert!(html.contains("opacity:0.5"));
        assert!(html.contains("border:3px solid #00ff00"));
        assert!(html.contains("border-radius:12px"));
    }

    #[test]
    fn render_primitive_ellipse_is_always_fully_rounded() {
        let p = PrimitiveParams { fill: "#123456".into(), ..Default::default() };
        let html = render_primitive("ellipse", &p);
        assert!(html.contains("border-radius:50%"));
    }

    #[test]
    fn render_primitive_text_escapes_and_applies_style() {
        let p = PrimitiveParams { text: "<script>x".into(), text_color: "#eeeeee".into(), font_size: 60.0, font_weight: 900, text_align: "center".into(), ..Default::default() };
        let html = render_primitive("text", &p);
        assert!(html.contains("&lt;script&gt;x"));
        assert!(!html.contains("<script>x"));
        assert!(html.contains("color:#eeeeee"));
        assert!(html.contains("font-size:60px"));
        assert!(html.contains("font-weight:900"));
        assert!(html.contains("justify-content:center"));
    }

    #[test]
    fn render_primitive_image_rejects_non_data_uri() {
        let p = PrimitiveParams { image_data_uri: Some("https://evil.example/x.png".into()), ..Default::default() };
        let html = render_primitive("image", &p);
        assert!(!html.contains("https://evil.example"));
        assert!(html.contains("No image"));
    }

    #[test]
    fn render_primitive_image_accepts_data_uri() {
        let p = PrimitiveParams { image_data_uri: Some("data:image/png;base64,AAAA".into()), object_fit: "cover".into(), ..Default::default() };
        let html = render_primitive("image", &p);
        assert!(html.contains("data:image/png;base64,AAAA"));
        assert!(html.contains("object-fit:cover"));
    }

    #[test]
    fn render_primitive_applies_drop_shadow_only_when_enabled() {
        let mut p = PrimitiveParams { shadow: false, ..Default::default() };
        assert!(!render_primitive("rect", &p).contains("drop-shadow"));
        p.shadow = true;
        p.shadow_blur = 20.0;
        assert!(render_primitive("rect", &p).contains("drop-shadow"));
    }

    #[test]
    fn render_primitive_linear_gradient_blends_both_colors_at_the_given_angle() {
        let p = PrimitiveParams { fill: "#ff0000".into(), fill_type: "linear".into(), fill_color2: "#0000ff".into(), gradient_angle: 45.0, ..Default::default() };
        let html = render_primitive("rect", &p);
        assert!(html.contains("linear-gradient(45deg, #ff0000, #0000ff)"));
    }

    #[test]
    fn render_primitive_radial_gradient_ignores_angle() {
        let p = PrimitiveParams { fill: "#ff0000".into(), fill_type: "radial".into(), fill_color2: "#0000ff".into(), ..Default::default() };
        let html = render_primitive("ellipse", &p);
        assert!(html.contains("radial-gradient(circle, #ff0000, #0000ff)"));
    }

    #[test]
    fn render_primitive_solid_fill_type_never_emits_a_gradient() {
        let p = PrimitiveParams { fill: "#ff0000".into(), fill_type: "solid".into(), fill_color2: "#0000ff".into(), ..Default::default() };
        let html = render_primitive("rect", &p);
        assert!(!html.contains("gradient"));
        assert!(html.contains("background:#ff0000"));
    }

    #[test]
    fn render_primitive_blend_mode_applied_only_when_not_normal() {
        let mut p = PrimitiveParams { blend_mode: "normal".into(), ..Default::default() };
        assert!(!render_primitive("rect", &p).contains("mix-blend-mode"));
        p.blend_mode = "multiply".into();
        assert!(render_primitive("rect", &p).contains("mix-blend-mode: multiply"));
    }

    #[test]
    fn render_primitive_rejects_unknown_blend_mode() {
        let p = PrimitiveParams { blend_mode: "javascript:alert(1)".into(), ..Default::default() };
        let html = render_primitive("rect", &p);
        assert!(!html.contains("javascript"));
        assert!(!html.contains("mix-blend-mode"));
    }

    #[test]
    fn render_canvas_applies_rotation_transform_to_the_iframe_wrapper() {
        let mut el = canvas_element("a", "lower-third", 10.0, 10.0, 0);
        el.rotation = 45.0;
        let html = render_canvas(&[el]).unwrap();
        assert!(html.contains("transform: rotate(45deg)"));
    }

    #[test]
    fn render_canvas_no_transform_when_rotation_is_zero() {
        let el = canvas_element("a", "lower-third", 10.0, 10.0, 0);
        let html = render_canvas(&[el]).unwrap();
        assert!(!html.contains("rotate("));
    }

    #[test]
    fn render_canvas_dispatches_primitive_kinds_to_render_primitive_not_render_template() {
        let mut el = canvas_element("a", "lower-third", 10.0, 10.0, 0);
        el.kind = Some("rect".to_string());
        el.primitive = Some(PrimitiveParams { fill: "#abcdef".into(), ..Default::default() });
        let html = render_canvas(&[el]).unwrap();
        // The primitive's fill color appears in the JSON-encoded srcdoc string;
        // the template's own title text ("Hello <World>" from params()) must not.
        assert!(html.contains("#abcdef"));
        assert!(!html.contains("Hello"));
    }

    #[test]
    fn canvas_element_with_kind_and_rotation_round_trips_through_json() {
        let mut el = canvas_element("a", "lower-third", 10.0, 20.0, 1);
        el.kind = Some("text".to_string());
        el.rotation = 90.0;
        el.primitive = Some(PrimitiveParams { text: "hi".into(), ..Default::default() });
        let json = serde_json::to_string(&el).unwrap();
        let back: CanvasElement = serde_json::from_str(&json).unwrap();
        assert_eq!(back.kind.as_deref(), Some("text"));
        assert_eq!(back.rotation, 90.0);
        assert_eq!(back.primitive.unwrap().text, "hi");
    }

    #[test]
    fn canvas_element_missing_kind_rotation_primitive_deserializes_as_pre_existing_template() {
        // A saved canvas from before primitives existed has none of these
        // fields at all — must still parse and behave as a template element.
        let old_json = r#"{
            "id": "a", "xPct": 10.0, "yPct": 10.0, "widthPct": 30.0, "heightPct": 20.0, "zIndex": 0,
            "params": { "template": "lower-third", "title": {"text": "t", "source": ""}, "subtitle": {"text": "", "source": ""} }
        }"#;
        let el: CanvasElement = serde_json::from_str(old_json).unwrap();
        assert_eq!(el.kind, None);
        assert_eq!(el.rotation, 0.0);
        assert!(el.primitive.is_none());
    }

    #[test]
    fn strip_json_fence_removes_markdown_code_fences() {
        assert_eq!(strip_json_fence("```json\n[{\"a\":1}]\n```"), "[{\"a\":1}]");
        assert_eq!(strip_json_fence("[{\"a\":1}]"), "[{\"a\":1}]");
    }

    #[test]
    fn build_canvas_from_specs_drops_unknown_templates_and_clamps_bounds() {
        let specs = vec![
            AiElementSpec {
                template: "lower-third".to_string(),
                title: "Now Playing".to_string(),
                subtitle: String::new(),
                text_color: "#ffffff".to_string(),
                accent_color: "not-a-color".to_string(),
                x_pct: 500.0,
                y_pct: -20.0,
                width_pct: 0.0,
                height_pct: 999.0,
            },
            AiElementSpec {
                template: "not-a-real-template".to_string(),
                ..Default::default()
            },
        ];
        let elements = build_canvas_from_specs(specs);
        assert_eq!(elements.len(), 1, "unknown template should be dropped");
        let el = &elements[0];
        assert_eq!(el.x_pct, 90.0);
        assert_eq!(el.y_pct, 0.0);
        assert_eq!(el.width_pct, 30.0, "non-positive width falls back to a sane default");
        assert_eq!(el.height_pct, 50.0);
        assert_eq!(el.params.accent_color, default_accent_color(), "invalid color falls back to default");
    }

    #[test]
    fn build_canvas_from_specs_caps_at_six_elements() {
        let specs: Vec<AiElementSpec> = (0..10)
            .map(|_| AiElementSpec { template: "text-box".to_string(), ..Default::default() })
            .collect();
        assert_eq!(build_canvas_from_specs(specs).len(), 6);
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
        write_canvas_sidecar(&dir, file_name, &CanvasParams { elements: elements.clone(), width: default_canvas_width(), height: default_canvas_height() }).unwrap();

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
    fn canvas_params_missing_width_height_deserializes_as_1920x1080() {
        // A sidecar saved before custom canvas sizes existed has neither
        // field at all — must still parse and default to the old-and-only
        // size rather than failing or coming back as 0x0.
        let old_json = r#"{"elements":[]}"#;
        let parsed: CanvasParams = serde_json::from_str(old_json).unwrap();
        assert_eq!(parsed.width, 1920);
        assert_eq!(parsed.height, 1080);
    }

    #[test]
    fn canvas_params_custom_width_height_round_trips_through_json() {
        let params = CanvasParams { elements: vec![], width: 1080, height: 1920 };
        let json = serde_json::to_string(&params).unwrap();
        let back: CanvasParams = serde_json::from_str(&json).unwrap();
        assert_eq!(back.width, 1080);
        assert_eq!(back.height, 1920);
    }

    #[test]
    fn canvas_sidecar_round_trips_a_custom_vertical_canvas_size() {
        let dir = std::env::temp_dir().join(format!("sf-canvas-size-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let elements = vec![canvas_element("a", "lower-third", 5.0, 10.0, 1)];
        let html = render_canvas(&elements).unwrap();
        let file_name = "canvas-size-test.html";
        std::fs::write(dir.join(file_name), html).unwrap();
        write_canvas_sidecar(&dir, file_name, &CanvasParams { elements, width: 1080, height: 1920 }).unwrap();
        let loaded: CanvasParams = serde_json::from_str(&std::fs::read_to_string(canvas_sidecar_path(&dir, file_name)).unwrap()).unwrap();
        assert_eq!(loaded.width, 1080);
        assert_eq!(loaded.height, 1920);
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
            assert!(
                html.contains("backdrop-filter: blur(20px)"),
                "template {t} should render with real glassmorphism (backdrop blur), not just a flat translucent box"
            );
        }
    }

    #[test]
    fn default_background_opacity_is_translucent_enough_to_show_the_glass_blur() {
        // A near-opaque card (the old 0.85 default) hides backdrop-filter
        // almost entirely — glassmorphism only reads as "glass" when
        // there's something visible to blur through.
        assert!(default_bg_opacity() < 0.7);
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
    fn uploaded_custom_font_wins_over_google_font_and_embeds_a_font_face() {
        let mut p = params("lower-third");
        p.font_family = "Bebas Neue".to_string();
        p.custom_font_data_uri = Some("data:font/ttf;base64,AAAA".to_string());
        p.custom_font_name = "My Stream Font".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains("@font-face"));
        assert!(html.contains(r#"font-family: "My Stream Font""#));
        assert!(html.contains("data:font/ttf;base64,AAAA"));
        assert!(!html.contains("fonts.googleapis.com"), "an uploaded font should skip the Google Fonts link entirely");
    }

    #[test]
    fn now_playing_renders_every_position_with_expected_structure() {
        for (position, has_cover) in [
            ("horizontal-left", true),
            ("horizontal-right", true),
            ("vertical", true),
            ("compact", true),
            ("info-only", false),
            ("", true), // unrecognized/default falls back to horizontal-left
        ] {
            let mut p = params("now-playing");
            p.position = position.to_string();
            let html = render_template(&p).unwrap();
            assert!(html.contains(r#"id="w""#), "{position}: missing root widget-container");
            assert!(html.contains(r#"id="t""#), "{position}: missing title element");
            assert!(html.contains(r#"id="r""#), "{position}: missing released element");
            assert!(html.contains(r#"id="g""#), "{position}: missing genre element");
            assert!(html.contains(r#"id="p""#), "{position}: missing publisher element");
            assert!(html.contains(r#"id="s""#), "{position}: missing session timer element");
            assert_eq!(html.contains(r#"id="a""#), has_cover, "{position}: cover-art element presence mismatch");
            assert!(html.contains("Montserrat"), "{position}: should load the Montserrat font");
            assert!(html.contains("metallic-text"), "{position}: should use the metallic gradient text style");
        }
    }

    #[test]
    fn now_playing_polling_script_uses_shared_token_lookup_and_statusforge_endpoints() {
        let mut p = params("now-playing");
        p.position = "horizontal-left".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains("function getOverlayToken()"), "should emit the shared token-lookup helper");
        assert!(html.contains("custom-overlay"), "shared token lookup must recognize Maker-served custom-overlay URLs");
        assert!(html.contains("http://127.0.0.1:53735/status"));
        assert!(html.contains("http://127.0.0.1:53735/settings"));
        assert!(
            !html.contains("ws://127.0.0.1:53735/data-ws"),
            "should use its own StatusForge polling, not the generic bound-field WebSocket"
        );
    }

    #[test]
    fn now_playing_ignores_text_color_accent_and_opacity_fields() {
        let mut p = params("now-playing");
        p.position = "horizontal-left".to_string();
        p.text_color = "#ff0000".to_string();
        p.accent_color = "#00ff00".to_string();
        let html = render_template(&p).unwrap();
        assert!(!html.contains("#ff0000"), "text color should be ignored — this template's look is fixed");
        assert!(!html.contains("#00ff00"), "accent color should be ignored — this template's look is fixed");
    }

    #[test]
    fn compact_cover_nests_the_art_inside_the_info_box() {
        let mut p = params("now-playing");
        p.position = "compact".to_string();
        let html = render_template(&p).unwrap();
        assert!(html.contains("cover-thumb"), "compact should use the inline cover-thumb style, not the standalone game-art panel");
        assert!(!html.contains("game-art"), "compact should not also render the standalone game-art layout");
    }

    #[test]
    fn game_logo_renders_glow_panel_and_polls_for_logo_url() {
        let p = params("game-logo");
        let html = render_template(&p).unwrap();
        assert!(html.contains(r#"id="w""#));
        assert!(html.contains(r#"id="lg""#), "missing the logo <img> element");
        assert!(html.contains("glow-panel"));
        assert!(html.contains("function getOverlayToken()"));
        assert!(html.contains("http://127.0.0.1:53735/status"));
        assert!(html.contains("logo_url"), "should poll for and use the game's logo_url");
    }

    #[test]
    fn non_data_uri_custom_font_is_rejected() {
        let mut p = params("lower-third");
        p.custom_font_data_uri = Some("https://evil.example/font.ttf".to_string());
        let html = render_template(&p).unwrap();
        assert!(!html.contains("@font-face"));
        assert!(!html.contains("evil.example"));
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

    #[test]
    fn rename_sets_and_clears_a_display_name_override_without_touching_the_file() {
        let dir = std::env::temp_dir().join(format!("sf-overlay-rename-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("lower-third.html"), "<html></html>").unwrap();

        let mut names = load_names_map(&dir);
        assert!(names.is_empty());
        names.insert("lower-third.html".to_string(), "My Cool Overlay".to_string());
        save_names_map(&dir, &names).unwrap();

        let reloaded = load_names_map(&dir);
        assert_eq!(reloaded.get("lower-third.html").unwrap(), "My Cool Overlay");
        assert!(dir.join("lower-third.html").exists(), "renaming must never touch the actual file");

        // Clearing (what overlay_rename_custom does for an empty name).
        let mut cleared = reloaded;
        cleared.remove("lower-third.html");
        save_names_map(&dir, &cleared).unwrap();
        assert!(load_names_map(&dir).get("lower-third.html").is_none());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn version_history_saves_lists_newest_first_and_restores() {
        let dir = std::env::temp_dir().join(format!("sf-overlay-history-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        let mut p = params("lower-third");
        p.title.text = "First".to_string();
        std::fs::write(dir.join("hist.html"), render_template(&p).unwrap()).unwrap();
        write_params_sidecar(&dir, "hist.html", &p).unwrap();

        // First snapshot captures "First".
        let id1 = save_version_internal(&dir, "hist.html", "Checkpoint one").unwrap().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));

        // Simulate an edit + save, then snapshot again — this captures "Second".
        p.title.text = "Second".to_string();
        write_params_sidecar(&dir, "hist.html", &p).unwrap();
        let id2 = save_version_internal(&dir, "hist.html", "").unwrap().unwrap();
        assert_ne!(id1, id2);

        let hdir = history_dir(&dir, "hist");
        let mut versions: Vec<VersionInfo> = std::fs::read_dir(&hdir)
            .unwrap()
            .flatten()
            .map(|e| {
                let env: VersionEnvelope = serde_json::from_str(&std::fs::read_to_string(e.path()).unwrap()).unwrap();
                VersionInfo { id: e.file_name().to_string_lossy().to_string(), label: env.label, timestamp: env.timestamp }
            })
            .collect();
        versions.sort_by_key(|v| -v.timestamp);
        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].id, id2, "newest snapshot should sort first");
        assert_eq!(versions[1].label, "Checkpoint one");
        assert_eq!(versions[0].label, "Checkpoint", "an empty label falls back to a sane default");

        // Restoring the first snapshot should bring "First" back.
        let env1: VersionEnvelope = serde_json::from_str(&std::fs::read_to_string(hdir.join(&id1)).unwrap()).unwrap();
        let restored: TemplateParams = serde_json::from_value(env1.data).unwrap();
        assert_eq!(restored.title.text, "First");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn version_history_prunes_oldest_entries_past_the_cap() {
        let dir = std::env::temp_dir().join(format!("sf-overlay-history-prune-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = params("lower-third");
        std::fs::write(dir.join("prune.html"), render_template(&p).unwrap()).unwrap();
        write_params_sidecar(&dir, "prune.html", &p).unwrap();

        for _ in 0..(MAX_HISTORY_ENTRIES + 5) {
            save_version_internal(&dir, "prune.html", "").unwrap();
            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        let hdir = history_dir(&dir, "prune");
        let count = std::fs::read_dir(&hdir).unwrap().count();
        assert_eq!(count, MAX_HISTORY_ENTRIES, "history should be pruned back down to the cap");

        std::fs::remove_dir_all(&dir).ok();
    }
}
