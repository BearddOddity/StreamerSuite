import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

// Joystick.tv has no documented public API for viewer/follower counts (their
// own official example bot repo only covers chat, and every attempt to reach
// their API docs from here got blocked) — /reporting is the real, login-gated
// dashboard with your actual numbers. Rather than guess at endpoint/field
// names and risk showing wrong data silently, this opens it in its own native
// window (same pattern as Multi-Chat) so you can log in and see the real
// thing. It's intentionally not granted any Tauri command capability — it's
// a window onto an external, untrusted-by-us site, nothing more.
const WINDOW_LABEL = "joystick-reporting";

export async function openJoystickReporting() {
  const existing = await WebviewWindow.getByLabel(WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(WINDOW_LABEL, {
    url: "https://joystick.tv/reporting",
    title: "Joystick.tv Reporting",
    width: 1000,
    height: 720,
    minWidth: 480,
    minHeight: 400,
    resizable: true,
  });
}
