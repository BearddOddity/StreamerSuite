import type { InputHTMLAttributes } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "size"> {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Error message — shows a red border + message below the field. */
  error?: string;
  /** Helper text below the field (hidden when `error` is set). */
  help?: string;
  className?: string;
}

/** Input — glass text field, matching Select's visual language. */
export function Input({ label, value, onChange, placeholder, type = "text", disabled = false, error, help, className = "", ...rest }: InputProps) {
  const input = (
    <input
      type={type}
      className={`bd-input ${error ? "bd-field-error" : ""} ${className}`.trim()}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={!!error}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      {...rest}
    />
  );
  const msg = error ? <div className="bd-field-error-msg">{error}</div> : help ? <div className="bd-field-help">{help}</div> : null;
  if (!label) {
    return (
      <>
        {input}
        {msg}
      </>
    );
  }
  return (
    <label style={{ display: "block" }}>
      <span className="bd-label" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </span>
      {input}
      {msg}
    </label>
  );
}
