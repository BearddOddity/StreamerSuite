import type { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  /** Toggled/on state — accent-tinted fill instead of the ghost outline. */
  selected?: boolean;
  /** Leading glyph (emoji or small inline SVG). */
  icon?: ReactNode;
  /** Show a trailing × to remove/clear the chip. */
  removable?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
  /** Pass to make the chip an interactive toggle (renders a <button>); omit for a static tag. */
  onClick?: () => void;
  className?: string;
}

/** Chip — small pill for filters, tags and removable selections. Ghost outline
 *  by default; `selected` swaps to the accent-tinted fill used across filter
 *  rows (genre pickers, active-facet chips). Distinct from Badge, which is
 *  for fixed status/metadata rather than toggleable or removable filters. */
export function Chip({
  children,
  selected = false,
  icon,
  removable = false,
  onRemove,
  disabled = false,
  onClick,
  className = "",
}: ChipProps) {
  const interactive = !!onClick;
  const Tag = (interactive ? "button" : "span") as "button";
  return (
    <Tag
      className={`bd-chip ${selected ? "bd-chip-selected" : ""} ${className}`.trim()}
      onClick={disabled ? undefined : onClick}
      disabled={interactive ? disabled : undefined}
      aria-pressed={interactive ? selected : undefined}
    >
      {icon != null && <span className="bd-chip-icon">{icon}</span>}
      <span>{children}</span>
      {removable && (
        <span
          className="bd-chip-remove"
          role="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        >
          ×
        </span>
      )}
    </Tag>
  );
}
