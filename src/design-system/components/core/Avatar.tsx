import type { ReactNode } from "react";

export interface AvatarProps {
  src?: string;
  /** Used for the fallback initials and the title tooltip. */
  name?: string;
  size?: number;
  className?: string;
}

/** Avatar — a photo, or initials derived from `name` when there's no `src`. */
export function Avatar({ src, name = "", size = 36, className = "" }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={`bd-avatar ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      title={name}
    >
      {src ? <img src={src} alt={name} width={size} height={size} style={{ objectFit: "cover" }} /> : initials}
    </span>
  );
}

export interface AvatarGroupProps {
  children: ReactNode;
  className?: string;
}

/** AvatarGroup — overlapping stack of Avatars (`bd-avatar-group` handles the overlap). */
export function AvatarGroup({ children, className = "" }: AvatarGroupProps) {
  return <div className={`bd-avatar-group ${className}`.trim()}>{children}</div>;
}
