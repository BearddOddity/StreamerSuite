import type { ReactNode } from "react";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Tooltip — hover/focus label above the wrapped element. */
export function Tooltip({ label, children, className = "" }: TooltipProps) {
  return (
    <span className={`bd-tooltip-wrap ${className}`.trim()}>
      {children}
      <span className="bd-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
