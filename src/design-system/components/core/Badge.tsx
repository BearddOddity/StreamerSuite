import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  /** Semantic color. */
  variant?: "ghost" | "purple" | "green" | "red" | "amber" | "cyan";
  /** Show a leading status dot. */
  dot?: boolean;
  className?: string;
}

/** Badge — small pill label for status/metadata (uppercase-friendly, wide
 *  tracking). Six semantic tints matched to the brand palette. */
export function Badge({ children, variant = "ghost", dot = false, className = "" }: BadgeProps) {
  return (
    <span className={`bd-badge bd-badge-${variant} ${className}`.trim()}>
      {dot && <span className="bd-dot bd-dot-on" style={{ width: 6, height: 6 }} />}
      {children}
    </span>
  );
}
