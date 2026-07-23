import { useEffect, useRef } from "react";

// Multi-Chat's real frontend is a self-contained vanilla HTML/CSS/JS app
// (public/multichat/) — no build step, no React, written before this app's
// React rewrite. Porting its IRC/Pusher/ActionCable parsing, emote merging,
// and moderation logic into React would be a large, risky rewrite of
// working, battle-tested code for no functional gain. Instead this mounts
// the *exact same* markup/CSS/JS, unmodified, straight into this document
// instead of a separate window or webview — which is what actually solves
// the two real problems that motivated a "React version" in the first
// place: it shares this document's Tauri IPC bridge automatically (no
// separate-webview bridging needed), and it shares this document's CSS
// custom properties, so accent/theme changes apply live with zero glue
// code (see the --bd-accent handling below).
const ROOT_ID = "mc-embed-root";

// multichat.js's own :root block hardcodes a fallback purple for
// --bd-accent (needed when the page loads standalone, e.g. as an OBS
// browser-source overlay with no Tauri/theme context). Embedded here it
// shares this document's real :root, which already defines
// --bd-accent: var(--user-accent, #9146ff) — the live, user-chosen theme
// color. Scoping the rest of multichat's tokens to #mc-embed-root (instead
// of leaving them on :root, where they'd leak into and override the main
// app's own global tokens) while dropping just this one hardcoded
// declaration lets --bd-accent fall through to the inherited live value
// instead of the static fallback.
function scopeMultichatCss(css: string): string {
  return css
    .replace(/:root\s*\{/, `#${ROOT_ID} {`)
    .replace(/--bd-accent:\s*#9146ff;/, "")
    // multichat's own `html, body { ... }` base rule (margin/height/color/
    // font-family) is meant for when it's the whole page — unscoped, it'd
    // leak onto this app's real <body> instead, and its color/font-family
    // values reference tokens that only exist inside #mc-embed-root, so
    // outside that scope they'd resolve to nothing.
    .replace(/html,\s*body\s*\{[^}]*\}/, `#${ROOT_ID} { height: 100%; }`);
}

export default function EmbeddedMultiChat() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Idempotent by DOM presence, not a module-level flag: React 18
    // StrictMode double-invokes this effect once in dev, and a plain
    // boolean flag would leave the second (real) container empty since it
    // wouldn't know to re-attach rather than skip. Checking for the actual
    // "shell" element multichat.js creates handles that correctly, and
    // also protects against ever re-running the boot sequence (which
    // would throw on the second `<script>` injection — its top-level
    // consts aren't safe to redeclare in the same document).
    const existingShell = document.getElementById("shell");
    if (existingShell) {
      const existingRoot = document.getElementById(ROOT_ID);
      if (existingRoot && existingRoot.parentElement !== container) {
        container.appendChild(existingRoot);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const html = await fetch("/multichat/index.html").then((r) => r.text());
      if (cancelled) return;
      const parsed = new DOMParser().parseFromString(html, "text/html");

      // Head assets: Google Fonts + the page's own <style> block. Injected
      // once into this document's real <head> — checked by href/marker so
      // a second run (shouldn't happen, but defensively) never duplicates.
      parsed.querySelectorAll('link[rel="preconnect"], link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute("href");
        if (href && document.head.querySelector(`link[href="${href}"]`)) return;
        document.head.appendChild(document.importNode(link, true));
      });
      parsed.querySelectorAll("style").forEach((styleEl) => {
        const tag = document.createElement("style");
        tag.textContent = scopeMultichatCss(styleEl.textContent ?? "");
        document.head.appendChild(tag);
      });

      // Body markup, minus the <script> tag (loaded separately below via a
      // real same-origin <script src>, since CSP's script-src 'self' blocks
      // inline script content).
      const root = document.createElement("div");
      root.id = ROOT_ID;
      root.className = "h-full w-full";
      Array.from(parsed.body.children).forEach((node) => {
        if (node.tagName === "SCRIPT") return;
        root.appendChild(document.importNode(node, true));
      });
      container.appendChild(root);

      const script = document.createElement("script");
      script.src = "/multichat/multichat.js";
      document.body.appendChild(script);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
