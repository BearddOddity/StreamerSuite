import type { ReactNode } from "react";

export interface CoverImageProps {
  src?: string;
  alt?: string;
  title?: ReactNode;
  badge?: ReactNode;
  width?: number;
  /** Slow ambient scale animation, e.g. for a "now playing" hero cover. */
  breathe?: boolean;
  rounded?: number;
  className?: string;
}

/** CoverImage — 2:3 cover-art tile with a title caption gradient and a no-art fallback. */
export function CoverImage({ src, alt = "", title, badge, width = 160, breathe = false, rounded = 16, className = "" }: CoverImageProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        aspectRatio: "2 / 3",
        borderRadius: rounded,
        overflow: "hidden",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid var(--line-1)",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", animation: breathe ? "bd-cover-breathe 8s ease-in-out infinite" : undefined }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            textAlign: "center",
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            color: "var(--text-muted)",
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            lineHeight: 1.25,
          }}
        >
          {alt || title}
        </div>
      )}
      {badge != null && (
        <span style={{ position: "absolute", top: 6, left: 6 }} className="bd-badge bd-badge-ghost">
          {badge}
        </span>
      )}
      {title != null && (
        <>
          <div
            style={{
              position: "absolute",
              inset: "auto 0 0 0",
              height: "50%",
              background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "auto 0 0 0",
              padding: "6px 8px",
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
        </>
      )}
    </div>
  );
}
