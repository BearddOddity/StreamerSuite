import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useSharedSettings } from "@/settings";
import "../../design-system/styles.css";
import { Button, Card } from "../../design-system/components/core";

// Multi-Chat's real frontend is a self-contained vanilla HTML/CSS/JS app
// (no build step, no React) — see public/multichat/. Rather than port its
// IRC/Pusher/ActionCable parsing, emote merging, and moderation logic into
// React (a large, risky rewrite of working code), it runs unmodified, in
// either a separate native window or a native child webview docked into
// this pane — never as an <iframe>. Tauri only injects the window.__TAURI__
// IPC bridge into a webview's own main frame; an iframe never gets it, so
// every invoke() call inside Multi-Chat would silently no-op. Both a
// separate WebviewWindow and a docked child Webview (see docking.rs) are
// real main frames, so IPC works exactly as it does standalone.
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

type Mode = "choosing" | "own-window" | "docked";

// Multi-Chat's window/webview has its own localStorage (separate origin),
// so it can't just read the current accent color off shared storage — it
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
  const [mode, setMode] = useState<Mode>("choosing");
  const [opening, setOpening] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // While docked, keep the native child webview's bounds pinned to this
  // pane — window resizes, sidebar toggles, anything that moves this div.
  //
  // Creating/repositioning a native child webview can itself trigger a
  // spurious window "resize" (observed on Windows/WebView2), which would
  // refire sync() -> another dock_multichat call -> more native window
  // churn, in a tight loop that starves the main thread (symptoms: blank
  // docked pane, frozen UI, window won't even close). Two guards break
  // that loop: skip the IPC call entirely when the bounds haven't
  // meaningfully changed, and never let more than one dock_multichat call
  // be in flight — a resize that lands mid-call just overwrites the
  // pending one instead of queuing a burst of them.
  useEffect(() => {
    if (mode !== "docked") return;
    const el = dockRef.current;
    if (!el) return;

    let lastSent: { x: number; y: number; width: number; height: number } | null = null;
    let inFlight = false;
    let queued: { x: number; y: number; width: number; height: number } | null = null;

    const send = (rect: { x: number; y: number; width: number; height: number }) => {
      inFlight = true;
      invoke("dock_multichat", rect)
        .catch(() => {})
        .finally(() => {
          inFlight = false;
          if (queued) {
            const next = queued;
            queued = null;
            send(next);
          }
        });
    };

    const sync = () => {
      const r = el.getBoundingClientRect();
      const rect = { x: r.left, y: r.top, width: r.width, height: r.height };
      if (
        lastSent &&
        Math.abs(lastSent.x - rect.x) < 1 &&
        Math.abs(lastSent.y - rect.y) < 1 &&
        Math.abs(lastSent.width - rect.width) < 1 &&
        Math.abs(lastSent.height - rect.height) < 1
      ) {
        return;
      }
      lastSent = rect;
      if (inFlight) {
        queued = rect;
        return;
      }
      send(rect);
    };
    sync();
    pushAccentColor(theme.accentColor);

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      invoke("undock_multichat").catch(() => {});
    };
    // Intentionally only depends on mode — while already docked, accent
    // changes reach it via SharedSettingsContext's own live emit, not this effect.
  }, [mode]);

  if (mode === "choosing") {
    return (
      <div className="h-full flex items-center justify-center bg-[#050505] p-6">
        <Card padding={24} className="w-full max-w-md text-center">
          <div className="text-5xl mb-3">💬</div>
          <h2 className="text-[16px] font-bold text-white/90 mb-1.5">Open Multi-Chat</h2>
          <p className="text-[12px] text-white/40 mb-6">
            Run it docked inside StreamerSuite, or as its own floating window you can move to a second monitor.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="cta" onClick={() => setMode("docked")}>
              🖥️ Open in StreamerSuite
            </Button>
            <Button
              variant="ghost"
              disabled={opening}
              onClick={async () => {
                setOpening(true);
                try {
                  await openMultiChatWindow();
                  pushAccentColor(theme.accentColor);
                  setMode("own-window");
                } finally {
                  setOpening(false);
                }
              }}
            >
              🪟 Open in its own window
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === "docked") {
    return <div ref={dockRef} className="h-full w-full bg-[#050505]" />;
  }

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
