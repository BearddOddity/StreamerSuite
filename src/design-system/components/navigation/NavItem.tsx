import type { ReactNode } from "react";

export interface NavItemProps {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  /** Icon-only mode, e.g. when the parent Sidebar is collapsed. */
  collapsed?: boolean;
  onClick?: () => void;
  className?: string;
}

/** NavItem — a sidebar/rail navigation row. */
export function NavItem({ icon, label, active = false, badge, collapsed = false, onClick, className = "" }: NavItemProps) {
  return (
    <button
      className={`bd-nav ${active ? "bd-nav-active" : ""} ${className}`.trim()}
      onClick={onClick}
      style={collapsed ? { justifyContent: "center", padding: "10px 0", gap: 0 } : undefined}
      title={collapsed ? label : undefined}
    >
      {icon != null && <span className="bd-nav-icon">{icon}</span>}
      {!collapsed && <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{label}</span>}
      {!collapsed && badge != null && <span className="bd-badge bd-badge-ghost">{badge}</span>}
    </button>
  );
}
