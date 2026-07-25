import type { CSSProperties, ReactNode } from "react";

export interface ContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Container — centered max-width content wrapper for page sections. */
export function Container({ children, className = "", style }: ContainerProps) {
  return (
    <div className={`bd-container ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
