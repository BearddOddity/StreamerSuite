import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** EmptyState — zero-state placeholder (no data yet, no results, etc.). */
export function EmptyState({ icon = "📭", title, description, action, className = "", children }: EmptyStateProps) {
  return (
    <div className={`bd-empty ${className}`.trim()}>
      <div className="bd-empty-icon">{icon}</div>
      <div className="bd-empty-title">{title}</div>
      {description && <div className="bd-empty-desc">{description}</div>}
      {action}
      {children}
    </div>
  );
}
