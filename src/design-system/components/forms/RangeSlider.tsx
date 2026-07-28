const SEGMENT_COUNT = 20;

export interface RangeSliderProps {
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  showValue?: boolean;
  className?: string;
}

/** RangeSlider — segmented meter matching ProgressBar's visual language,
 *  driven by a real `input[type=range]` (absolutely positioned, invisible)
 *  so keyboard, pointer-drag and screen readers all keep working. */
export function RangeSlider({ label, value = 0, min = 0, max = 100, step = 1, onChange, showValue = true, className = "" }: RangeSliderProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const litCount = Math.round((pct / 100) * SEGMENT_COUNT);
  const currentIndex = Math.max(0, litCount - 1);

  const track = (
    <div className={`bd-range-wrap ${className}`.trim()}>
      <input
        type="range"
        className="bd-range-input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange ? (e) => onChange(Number(e.target.value)) : undefined}
      />
      <div className="bd-range-track" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
          const cls = i === currentIndex && litCount > 0 ? "current" : i < litCount ? "on" : "";
          return <div key={i} className={`bd-range-seg ${cls}`.trim()} />;
        })}
      </div>
    </div>
  );

  if (!label && !showValue) return track;
  return (
    <div>
      {(label || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          {label && <span className="bd-label">{label}</span>}
          {showValue && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--bd-accent-text)", fontWeight: 600 }}>{value}</span>
          )}
        </div>
      )}
      {track}
    </div>
  );
}
