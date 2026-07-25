import { Children, cloneElement, isValidElement, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

export interface SidebarProps {
  logo?: ReactNode;
  /** NavItem elements (or a render-prop `(collapsed) => ReactNode`) — each element gets `collapsed` cloned onto it. */
  children: ReactNode | ((collapsed: boolean) => ReactNode);
  footer?: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapsible?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Sidebar — the app nav rail. Collapsible; each child (typically `NavItem`) is cloned with `collapsed`. */
export function Sidebar({
  logo,
  children,
  footer,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  collapsible = true,
  className = "",
  style,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsedProp != null ? collapsedProp : internalCollapsed;
  const toggle = () => {
    const next = !collapsed;
    onCollapsedChange?.(next);
    if (collapsedProp == null) setInternalCollapsed(next);
  };
  const content =
    typeof children === "function"
      ? children(collapsed)
      : Children.map(children, (child) =>
          isValidElement(child) ? cloneElement(child as ReactElement<{ collapsed?: boolean }>, { collapsed }) : child
        );
  return (
    <aside className={`bd-sidebar ${collapsed ? "bd-sidebar-collapsed" : ""} ${className}`.trim()} style={style}>
      {logo != null && !collapsed && <div className="bd-sidebar-logo">{logo}</div>}
      <nav className="bd-sidebar-nav">{content}</nav>
      <div className="bd-sidebar-foot">
        {footer}
        {collapsible && (
          <button className="bd-sidebar-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
