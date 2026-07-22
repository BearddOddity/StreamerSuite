import type { ReactNode } from "react";

export interface ButtonProps {
  children: ReactNode;
  /** Visual style. `cta` is the purple-gradient primary action. */
  variant?: "primary" | "cta" | "success" | "danger" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
}

/** Button — the brand's action control. Glass `primary` by default; `cta` is the
 *  purple-gradient hero action used for confirm/connect. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  type = "button",
  className = "",
}: ButtonProps) {
  const cls = ["bd-btn", `bd-btn-${variant}`, size === "sm" ? "bd-btn-sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
