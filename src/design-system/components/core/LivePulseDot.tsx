export interface LivePulseDotProps {
  /** Optional trailing text label. */
  label?: string;
  className?: string;
}

/** LivePulseDot — StatusDot's "on" state with an animated glow ring, for
 *  genuinely live/real-time state (a stream that's live now) rather than a
 *  static connection indicator. Respects prefers-reduced-motion globally. */
export function LivePulseDot({ label, className = "" }: LivePulseDotProps) {
  const dot = (
    <span className="bd-pulse-dot-wrap">
      <span className="bd-dot bd-dot-on" />
    </span>
  );
  if (!label) return <span className={className}>{dot}</span>;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      {dot}
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-body)" }}>{label}</span>
    </span>
  );
}

export interface LiveChipProps {
  children?: string;
  className?: string;
}

/** LiveChip — glass "LIVE" pill with the same pulsing dot, for corner badges. */
export function LiveChip({ children = "Live", className = "" }: LiveChipProps) {
  return (
    <span className={`bd-live-chip ${className}`.trim()}>
      <span className="bd-pulse-dot-wrap" style={{ width: 6, height: 6 }}>
        <span className="bd-dot bd-dot-on" style={{ width: 6, height: 6 }} />
      </span>
      {children}
    </span>
  );
}
