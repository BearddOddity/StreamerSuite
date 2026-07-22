export interface StatusDotProps {
  /** on = green glow, warn = amber glow, off = grey. */
  status?: "on" | "off" | "warn";
  /** Optional trailing text label. */
  label?: string;
  className?: string;
}

/** StatusDot — 8px connection/health indicator. Green (on) and amber (warn)
 *  glow; grey when off. Optionally pairs with a muted label. */
export function StatusDot({ status = "off", label, className = "" }: StatusDotProps) {
  const dot = <span className={`bd-dot bd-dot-${status}`} />;
  if (!label) return <span className={className}>{dot}</span>;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {dot}
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{label}</span>
    </span>
  );
}
