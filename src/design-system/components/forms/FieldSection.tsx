import { useState } from "react";
import type { ReactNode } from "react";

export interface FieldSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** FieldSection — collapsible group of fields, e.g. an "Advanced" settings block. */
export function FieldSection({ title, icon, children, defaultOpen = false }: FieldSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        border: "1px solid",
        borderColor: open ? "var(--bd-panel-border-strong, var(--line-strong))" : "var(--bd-panel-border, var(--line-1))",
        background: open ? "var(--bd-panel-bg-strong, rgba(0,0,0,0.45))" : "var(--bd-panel-bg, rgba(0,0,0,0.2))",
        backdropFilter: "var(--glass-blur, none)",
        WebkitBackdropFilter: "var(--glass-blur, none)",
        borderRadius: "var(--radius-2xl)",
        overflow: "hidden",
        transition: "all 0.3s ease",
        boxShadow: open ? "var(--shadow-2)" : "none",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--bd-panel-pad, 16px)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {icon != null && (
            <span className="bd-section-icon" style={{ width: 32, height: 32 }}>
              {icon}
            </span>
          )}
          <span
            style={{
              fontSize: "var(--bd-field-fs, var(--fs-xs))",
              fontWeight: 600,
              color: "var(--text-strong)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {title}
          </span>
        </span>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-faint)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.3s ease",
          }}
        >
          ▾
        </span>
      </button>
      {open && <div style={{ padding: "var(--bd-panel-pad, 20px)", borderTop: "1px solid var(--line-1)" }}>{children}</div>}
    </div>
  );
}
