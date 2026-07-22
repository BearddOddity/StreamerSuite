import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Trend string, e.g. "+12%" or "-3 today" — colors green/red by leading sign. */
  delta?: string;
  className?: string;
}

/** StatCard — glass metric tile: uppercase mono label, large display value,
 *  optional colored delta line. Use in stat-grid rows on dashboards. */
export function StatCard({ label, value, delta, className = "" }: StatCardProps) {
  const deltaUp = typeof delta === "string" && delta.trim().startsWith("+");
  const deltaDown = typeof delta === "string" && delta.trim().startsWith("-");
  return (
    <div className={`bd-card bd-stat-card ${className}`.trim()}>
      <div className="bd-stat-label">{label}</div>
      <div className="bd-stat-value">{value}</div>
      {delta != null && (
        <div className={`bd-stat-delta ${deltaUp ? "bd-stat-delta-up" : deltaDown ? "bd-stat-delta-down" : ""}`.trim()}>
          {delta}
        </div>
      )}
    </div>
  );
}
