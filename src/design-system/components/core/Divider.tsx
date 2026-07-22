import type { CSSProperties } from "react";

export interface DividerProps {
  /** Vertical 1px rule that stretches to its flex parent. */
  vertical?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Divider — hairline rule (white 6% alpha). Horizontal by default; `vertical`
 *  for inline separators. */
export function Divider({ vertical = false, className = "", style = {} }: DividerProps) {
  return <div className={`${vertical ? "bd-divider-v" : "bd-divider"} ${className}`.trim()} style={style} />;
}
