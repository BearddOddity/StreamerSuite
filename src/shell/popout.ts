import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

// Opens any registered app in its own top-level window, loading the exact
// same app bundle with a ?popout=<id> marker (see main.tsx / PopoutShell)
// instead of a bespoke standalone page per app. Since it's the same
// origin as the main window, the popout's own SharedSettingsProvider reads
// the same shared localStorage on mount and gets live cross-window updates
// via the native `storage` event (see SharedSettingsContext) — no
// window-to-window event bridging needed, unlike Multi-Chat's old
// dedicated static-page popout.
export async function openAppInNewWindow(
  appId: string,
  title: string,
  params?: Record<string, string>,
  size?: { width: number; height: number }
) {
  const label = `popout-${appId}`;
  const query = new URLSearchParams({ popout: appId, ...params });
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    // Note: an already-open popout only gets focused, not re-targeted —
    // `params` (e.g. "which overlay to edit") only takes effect on the
    // window's first load, same limitation as any other popout launch.
    await existing.setFocus();
    return;
  }
  new WebviewWindow(label, {
    url: `/index.html?${query.toString()}`,
    title,
    width: size?.width ?? 480,
    height: size?.height ?? 720,
    minWidth: 320,
    minHeight: 400,
    resizable: true,
  });
}
