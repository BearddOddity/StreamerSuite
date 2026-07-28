const SEGMENT_COUNT = 20;

export interface ProgressBarProps {
  value?: number;
  max?: number;
  className?: string;
}

/** ProgressBar — segmented meter (VU-meter style discrete lit blocks) rather
 *  than a continuous fill, per design preference. */
export function ProgressBar({ value = 0, max = 100, className = "" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const litCount = Math.round((pct / 100) * SEGMENT_COUNT);
  return (
    <div className={`bd-progress-track ${className}`.trim()}>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <div key={i} className={`bd-progress-seg ${i < litCount ? "on" : ""}`.trim()} />
      ))}
    </div>
  );
}
