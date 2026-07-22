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
            entries.push(OverlayEntry { name: humanize(&file_name), file: file_name });
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
        entries.push(OverlayEntry { name: humanize(&file_name), file: file_name });
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
    std::fs::remove_file(&path).map_err(|e| format!("couldn't remove file: {e}"))
}

/// Forwards a live (or test) alert from Alerts Hub to every connected
/// `/alerts-ws` overlay browser source.
#[tauri::command]
pub(crate) fn alerts_broadcast_to_overlay(event: serde_json::Value) {
    crate::server::push_alert_event(event);
}
