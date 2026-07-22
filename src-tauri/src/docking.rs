// Docks Multi-Chat's vanilla-JS frontend as a native child webview inside
// the main StreamerSuite window, instead of a separate top-level window.
// This is a real Webview (via Window::add_child), not an <iframe> — iframes
// never receive Tauri's window.__TAURI__ IPC bridge, so Multi-Chat's own
// invoke() calls would silently no-op. A child webview is its own main
// frame, so IPC works exactly as it does in the standalone-window mode.

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};

const DOCKED_LABEL: &str = "multichat-docked";

#[tauri::command]
pub fn dock_multichat(app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    if let Some(webview) = app.get_webview(DOCKED_LABEL) {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let window = app.get_window("main").ok_or("main window not found")?;
    let builder = WebviewBuilder::new(DOCKED_LABEL, WebviewUrl::App("multichat/index.html".into()));
    window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn undock_multichat(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(DOCKED_LABEL) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
