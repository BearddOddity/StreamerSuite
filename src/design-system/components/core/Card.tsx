import type { MouseEvent, ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  /** Inner padding in px. Default 20. */
  padding?: number;
  className?: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

/** Card — the glassmorphism surface shell (blurred black-alpha fill, hairline
 *  border, layered shadow, white top-inset highlight). Lifts border + shadow
 *  on hover. */
export function Card({ children, className = "", padding = 20, onClick }: CardProps) {
  return (
    <div className={`bd-card ${className}`.trim()} style={{ padding }} onClick={onClick}>
      {children}
    </div>
  );
}
