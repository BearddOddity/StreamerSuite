import { Fragment } from "react";

export interface BreadcrumbItem {
  label: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (item: BreadcrumbItem) => void;
  className?: string;
}

/** Breadcrumbs — path trail; the last item renders as the (non-clickable) current location. */
export function Breadcrumbs({ items, onNavigate, className = "" }: BreadcrumbsProps) {
  return (
    <div className={`bd-breadcrumbs ${className}`.trim()}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <span className="bd-crumb-sep">/</span>}
          {i === items.length - 1 ? (
            <span className="bd-crumb-current">{item.label}</span>
          ) : (
            <span className="bd-crumb" onClick={() => onNavigate?.(item)}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
