import { useEffect, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

// Multi-Chat's real frontend is a self-contained vanilla HTML/CSS/JS app
// (no build step, no React) — see public/multichat/. Rather than port its
// IRC/Pusher/ActionCable parsing, emote merging, and moderation logic into
// React (a large, risky rewrite of working code), it runs unmodified and
// unembedded, in its own native window backed by the same Tauri process and
// commands (multichat.rs) as the standalone app.
//
// It is NOT rendered as an <iframe> in this content pane: Tauri only injects
// the window.__TAURI__ IPC bridge into a webview's main frame on Linux/macOS
// (WebKit) — an iframe never gets it, so every invoke() call inside
// Multi-Chat would silently no-op. A separate WebviewWindow is itself a main
// frame, so IPC works exactly as it does standalone.
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

export default function MultiChatApp() {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    openMultiChatWindow();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#050505] text-center px-6">
      <div className="text-5xl">💬</div>
      <div>
        <h2 className="text-[16px] font-bold text-white/90">Multi-Chat is running in its own window</h2>
        <p className="text-[12px] text-white/40 mt-1 max-w-sm">
          It opened automatically. If you don't see it, use the button below.
        </p>
      </div>
      <button
        onClick={async () => {
          setOpening(true);
          try {
            await openMultiChatWindow();
          } finally {
            setOpening(false);
          }
        }}
        className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] text-white/70 border border-white/[0.08] hover:bg-white/[0.08] transition-all disabled:opacity-50"
        disabled={opening}
      >
        {opening ? "Opening…" : "Open / Focus Multi-Chat"}
      </button>
    </div>
  );
}
