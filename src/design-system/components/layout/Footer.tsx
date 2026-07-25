import type { ReactNode } from "react";

export interface FooterColumn {
  title: string;
  links: string[];
}

export interface FooterProps {
  columns?: FooterColumn[];
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  className?: string;
}

/** Footer — site footer: link columns + a bottom bar (copyright / secondary links). */
export function Footer({ columns = [], bottomLeft, bottomRight, className = "" }: FooterProps) {
  return (
    <footer className={`bd-footer ${className}`.trim()}>
      <div className="bd-container">
        <div className="bd-footer-grid">
          {columns.map((col) => (
            <div className="bd-footer-col" key={col.title}>
              <h4>{col.title}</h4>
              {(col.links || []).map((l) => (
                <span key={l} className="bd-footer-link">
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="bd-footer-bottom">
          <span>{bottomLeft}</span>
          <span>{bottomRight}</span>
        </div>
      </div>
    </footer>
  );
}
