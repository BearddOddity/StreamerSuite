import type { ReactNode } from "react";

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

/** Toolbar — glass action bar strip, e.g. a search input + a couple of buttons. */
export function Toolbar({ children, className = "" }: ToolbarProps) {
  return <div className={`bd-toolbar ${className}`.trim()}>{children}</div>;
}
