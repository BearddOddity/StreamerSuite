export interface StepperInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

/** StepperInput — glass +/− numeric control (delay seconds, retry counts, …). */
export function StepperInput({ value, min = 0, max = 100, step = 1, onChange, className = "" }: StepperInputProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className={`bd-stepper ${className}`.trim()}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <span className="bd-stepper-val">{value}</span>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}
