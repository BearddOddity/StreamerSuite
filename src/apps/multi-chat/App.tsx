import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useSharedSettings } from "@/settings";
import "../../design-system/styles.css";
import { Button } from "../../design-system/components/core";

// Multi-Chat's real frontend is a self-contained vanilla HTML/CSS/JS app
// (no build step, no React) — see public/multichat/. Rather than port its
// IRC/Pusher/ActionCable parsing, emote merging, and moderation logic into
// React (a large, risky rewrite of working code), it runs unmodified in a
// separate native window — never as an <iframe>. Tauri only injects the
// window.__TAURI__ IPC bridge into a webview's own main frame; an iframe
// never gets it, so every invoke() call inside Multi-Chat would silently
// no-op. A WebviewWindow is a real main frame, so IPC works exactly as it
// does standalone.
//
// Docking Multi-Chat inside this window as a native child webview (via
// Tauri's `unstable` Window::add_child API) was tried and pulled: live
// Windows testing hit a hard freeze on open — blank pane, unresponsive
// app, window not even closable — that survived two rounds of targeted
// fixes (debouncing the resize sync, then a CSP fix for Tauri's own IPC
// channel) and didn't reproduce at all in a real release build tested
// elsewhere. That points to a platform-specific bug in the unstable API
// itself rather than anything fixable from here, so docking is disabled
// until it can be root-caused with an actual Windows crash dump. The
// standalone-window path below is unaffected and was never implicated.
const WINDOW_LABEL = "multichat";

async function openMultiChatWindow() {
  const existing = await WebviewWindow.getByLabel(WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(WINDOW_LABEL, {
    url: "/multichat/index.html",
    title: "Multi-Chat",
    width: 560,
    height: 900,
    minWidth: 320,
    minHeight: 480,
    resizable: true,
  });
}

// Multi-Chat's window has its own localStorage (separate origin), so it
// can't just read the current accent color off shared storage — it
// listens for a Tauri event instead (see multichat.js). A brand-new window
// hasn't necessarily finished loading and registered that listener by the
// time it's created, so this re-sends for a couple seconds after open
// rather than emitting once and risking the first (only) emit landing
// before anyone's listening.
function pushAccentColor(accentColor: string) {
  for (const delay of [0, 300, 800, 1500]) {
    setTimeout(() => {
      emit("streamersuite://theme-accent", { accentColor }).catch(() => {});
    }, delay);
  }
}

export default function MultiChatApp() {
  const { theme } = useSharedSettings();
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    openMultiChatWindow().then(() => pushAccentColor(theme.accentColor));
    // Only auto-open once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#050505] text-center px-6">
      <div className="text-5xl">💬</div>
      <div>
        <h2 className="text-[16px] font-bold text-white/90">Multi-Chat is running in its own window</h2>
        <p className="text-[12px] text-white/40 mt-1 max-w-sm">If you don't see it, use the button below.</p>
      </div>
      <Button
        variant="primary"
        disabled={opening}
        onClick={async () => {
          setOpening(true);
          try {
            await openMultiChatWindow();
            pushAccentColor(theme.accentColor);
          } finally {
            setOpening(false);
          }
        }}
      >
        {opening ? "Opening…" : "Open / Focus Multi-Chat"}
      </Button>
    </div>
  );
}
