// Shared preview surface for both Makers. "Fit" just stretches the iframe
// to whatever box it's given — fine for a quick glance, but every size in
// the rendered overlay is in real px (font-size, padding, border-radius),
// so stretching it into an arbitrary box makes those proportions lie (a
// 26px title looks huge in a 400px-wide box, tiny in a 1200px one). "Actual
// Size" instead gives the iframe a true 1920×1080 viewport and scales the
// whole thing down uniformly with a CSS transform, so what's on screen is
// pixel-accurate to what a real 1920×1080 OBS canvas would show.
import { useEffect, useRef, useState } from "react";

const NATIVE_W = 1920;
const NATIVE_H = 1080;

export default function ScaledPreview({
  html,
  title,
  className,
  note,
}: {
  html: string;
  title: string;
  className?: string;
  /** Replaces the default caption below the preview — pass "" to omit it. */
  note?: string;
}) {
  const [actualSize, setActualSize] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!actualSize) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / NATIVE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [actualSize]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <label className="text-[10px] text-white/40 uppercase tracking-wide">Live Preview</label>
        <button
          onClick={() => setActualSize((s) => !s)}
          title="Toggle between a quick-fit view and true 1920×1080 scale"
          className="text-[10px] text-white/40 hover:text-white/70 px-2 py-0.5 rounded-md border border-white/10 shrink-0"
        >
          {actualSize ? "↺ Fit" : "⤢ Actual Size"}
        </button>
      </div>
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-white/[0.06] bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:20px_20px]"
        style={{ aspectRatio: "16 / 9" }}
      >
        {html &&
          (actualSize ? (
            <iframe
              title={title}
              srcDoc={html}
              className="pointer-events-none"
              style={{ width: NATIVE_W, height: NATIVE_H, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
            />
          ) : (
            <iframe title={title} srcDoc={html} className="w-full h-full pointer-events-none" style={{ border: 0 }} />
          ))}
      </div>
      {note !== "" && (
        <p className="text-[10px] text-white/25 mt-1.5">
          {note ??
            (actualSize
              ? "True 1920×1080 pixels, scaled down to fit — sizes and spacing match a real OBS canvas exactly."
              : "Checkered background simulates OBS transparency. Bound fields show sample values here.")}
        </p>
      )}
    </div>
  );
}
