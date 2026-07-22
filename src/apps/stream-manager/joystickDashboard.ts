import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

// Same reasoning as Stream Stats' reporting window: Joystick.tv has no
// verified API for updating stream title/category (their official bot repo
// only covers chat), so this opens their real dashboard instead of guessing
// at endpoint fields. Unlike /reporting (confirmed by the user), this URL is
// an unverified best guess at where stream settings live — flagged as such
// in the UI so it's obvious if it needs correcting.
const WINDOW_LABEL = "joystick-dashboard";
export const JOYSTICK_DASHBOARD_URL = "https://joystick.tv/dashboard";

export async function openJoystickDashboard() {
  const existing = await WebviewWindow.getByLabel(WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(WINDOW_LABEL, {
    url: JOYSTICK_DASHBOARD_URL,
    title: "Joystick.tv Dashboard",
    width: 1000,
    height: 720,
    minWidth: 480,
    minHeight: 400,
    resizable: true,
  });
}
