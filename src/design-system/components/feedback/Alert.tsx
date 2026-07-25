import type { ReactNode } from "react";

const ICONS: Record<string, string> = { info: "ℹ️", success: "✓", warn: "⚠️", error: "✕" };

export interface AlertProps {
  variant?: "info" | "success" | "warn" | "error";
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

/** Alert — persistent inline banner (not a toast; stays until dismissed or removed). */
export function Alert({ variant = "info", title, children, onClose, className = "" }: AlertProps) {
  return (
    <div className={`bd-alert bd-alert-${variant} ${className}`.trim()} role="alert">
      <span className="bd-alert-icon">{ICONS[variant]}</span>
      <div className="bd-alert-body">
        {title && <div className="bd-alert-title">{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button className="bd-alert-close" aria-label="Dismiss" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
}
