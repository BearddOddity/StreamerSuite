import type { ReactNode } from "react";

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Switch — glass toggle. With a `label`, renders as a full row (label left, switch right). */
export function Switch({ checked, onChange, label, disabled = false, className = "" }: SwitchProps) {
  const control = (
    <span
      className="bd-switch"
      data-checked={checked ? "true" : "false"}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange?.(!checked)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onChange?.(!checked);
        }
      }}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span className="bd-switch-thumb" />
    </span>
  );
  if (!label) return control;
  return (
    <label className={`bd-check-row ${className}`.trim()} style={{ justifyContent: "space-between" }}>
      <span>{label}</span>
      {control}
    </label>
  );
}
