import type { ReactNode } from "react";

const DEFAULT_ICONS: Record<string, string> = { success: "✓", error: "✕", info: "ⓘ" };

export interface ToastProps {
  children: ReactNode;
  variant?: "success" | "error" | "info";
  icon?: ReactNode;
  className?: string;
}

/** Toast — a single toast bubble. For a self-managing queue, use `ToastManager` + `bdToast.push()` instead. */
export function Toast({ children, variant = "info", icon, className = "" }: ToastProps) {
  return (
    <div className={`bd-toast bd-toast-${variant} ${className}`.trim()} style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontWeight: 700 }}>{icon ?? DEFAULT_ICONS[variant]}</span>
      <span>{children}</span>
    </div>
  );
}
