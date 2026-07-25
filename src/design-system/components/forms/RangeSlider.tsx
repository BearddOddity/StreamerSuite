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

/** RangeSlider — glass range input with an optional label + live value readout. */
export function RangeSlider({ label, value = 0, min = 0, max = 100, step = 1, onChange, showValue = true, className = "" }: RangeSliderProps) {
  const input = (
    <input
      type="range"
      className={`bd-range ${className}`.trim()}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange ? (e) => onChange(Number(e.target.value)) : undefined}
    />
  );
  if (!label && !showValue) return input;
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
      {input}
    </div>
  );
}
