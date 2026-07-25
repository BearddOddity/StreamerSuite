import type { ReactNode } from "react";

export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Checkbox — custom glass checkbox (not a native input, so it can be styled). */
export function Checkbox({ checked, onChange, label, disabled = false, className = "" }: CheckboxProps) {
  return (
    <label className={`bd-check-row ${className}`.trim()} style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <span
        className="bd-checkbox"
        data-checked={checked ? "true" : "false"}
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onChange?.(!checked)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onChange?.(!checked);
          }
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}
