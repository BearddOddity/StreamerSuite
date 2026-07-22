import type { ReactNode } from "react";

export interface SectionHeadProps {
  /** Leading glyph/emoji or node shown in the icon tile. */
  icon?: ReactNode;
  title: string;
  /** Muted one-line description under the title. */
  desc?: string;
  /** Optional trailing content (buttons, badges) right-aligned. */
  right?: ReactNode;
  className?: string;
}

/** SectionHead — the icon-tile + title + description row that heads every
 *  panel and settings block across the apps. */
export function SectionHead({ icon, title, desc, right, className = "" }: SectionHeadProps) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      className={className}
    >
      <div className="bd-section-head">
        {icon != null && <span className="bd-section-icon">{icon}</span>}
        <div style={{ minWidth: 0 }}>
          <div className="bd-section-title">{title}</div>
          {desc && <div className="bd-section-desc">{desc}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}
