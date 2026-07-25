import { useState } from "react";
import type { ReactNode } from "react";

export interface HeaderProps {
  logo?: ReactNode;
  links?: string[];
  actions?: ReactNode;
  className?: string;
}

/** Header — sticky site header with a mobile burger menu below 768px. */
export function Header({ logo = "beardd//oddity", links = [], actions, className = "" }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className={`bd-header ${className}`.trim()}>
      <div className="bd-container bd-header-inner">
        <div className="bd-logo">{logo}</div>
        <nav className="bd-header-links">
          {links.map((l) => (
            <span key={l} className="bd-header-link">
              {l}
            </span>
          ))}
        </nav>
        <div className="bd-header-actions">
          {actions}
          <button className="bd-header-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="bd-header-mobile-panel">
          {links.map((l) => (
            <span key={l} className="bd-header-link" onClick={() => setOpen(false)}>
              {l}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
