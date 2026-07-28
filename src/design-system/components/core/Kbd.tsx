export interface KbdProps {
  /** Individual key caps, e.g. ["⌘", "K"] or ["Ctrl", "Alt", "S"]. */
  keys: string[];
  className?: string;
}

/** Kbd — a keyboard-shortcut hint, one glass key cap per entry in `keys`. */
export function Kbd({ keys, className = "" }: KbdProps) {
  return (
    <span className={`bd-kbd ${className}`.trim()}>
      {keys.map((k, i) => (
        <span className="bd-kbd-key" key={i}>
          {k}
        </span>
      ))}
    </span>
  );
}
