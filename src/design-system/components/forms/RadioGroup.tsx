export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  value: string;
  onChange?: (value: string) => void;
  /** Array of strings or {value,label} objects. */
  options: (string | RadioOption)[];
  name?: string;
  disabled?: boolean;
  className?: string;
}

/** RadioGroup — custom glass radio buttons, stacked vertically. */
export function RadioGroup({ value, onChange, options, disabled = false, className = "" }: RadioGroupProps) {
  const opts: RadioOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className={className} role="radiogroup">
      {opts.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className="bd-check-row"
            style={{ marginBottom: 8, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
          >
            <span
              className="bd-radio"
              data-checked={checked ? "true" : "false"}
              role="radio"
              aria-checked={checked}
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && onChange?.(opt.value)}
            >
              <span className="bd-radio-dot" />
            </span>
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
