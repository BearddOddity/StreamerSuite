import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Array of strings or {value,label} objects. */
  options?: (string | SelectOption)[];
  disabled?: boolean;
  /** Error message — shows red border + message below the field. */
  error?: string;
  /** Helper text below the field (hidden when `error` is set). */
  help?: string;
  className?: string;
  /** Inline style overrides for the trigger box. */
  style?: CSSProperties;
  /** Inline style overrides for the open dropdown panel. */
  menuStyle?: CSSProperties;
}

/** Select — custom glass combobox (not a native <select>, so its open menu can
 *  be styled): blurred glass trigger with brand chevron, rounded dark-glass
 *  dropdown panel, each option its own soft glass row with hover/selected
 *  blend and checkmark. Full keyboard support (Enter/Space/Arrows/Escape) and
 *  click-outside-to-close. Reads the system's canonical --glass-* tokens, so
 *  it reshapes along with every other glass surface. */
export function Select({
  label,
  value,
  onChange,
  options = [],
  disabled = false,
  error,
  help,
  className = "",
  style,
  menuStyle,
}: SelectProps) {
  const opts: SelectOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const selected = opts.find((o) => o.value === value);
  const selectedIdx = opts.findIndex((o) => o.value === value);

  const commit = (idx: number) => {
    const o = opts[idx];
    if (o && onChange) onChange(o.value);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(selectedIdx >= 0 ? selectedIdx : 0);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => Math.min(opts.length - 1, i < 0 ? 0 : i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, i < 0 ? 0 : i - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) commit(focusedIndex);
        break;
      default:
        break;
    }
  };

  const trigger = (
    <div
      className={`glass-select ${error ? "bd-field-error" : ""} ${className}`.trim()}
      style={{ ...style, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && setOpen((o) => !o)}
      onKeyDown={onKeyDown}
    >
      <span className={selected ? "" : "glass-select-placeholder"}>{selected ? selected.label : "Select…"}</span>
      <svg className="glass-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
  const menu = (
    <ul className={open ? "glass-menu open" : "glass-menu"} role="listbox" style={menuStyle}>
      {opts.map((o, i) => (
        <li
          key={o.value}
          role="option"
          aria-selected={o.value === value}
          className={`glass-option${i === focusedIndex ? " focused" : ""}${o.value === value ? " selected" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            commit(i);
          }}
          onMouseEnter={() => setFocusedIndex(i)}
        >
          <span>{o.label}</span>
          {o.value === value && <span className="glass-option-check">✓</span>}
        </li>
      ))}
    </ul>
  );
  const wrapped = (
    <div className="glass-select-wrapper" ref={wrapRef}>
      {trigger}
      {menu}
    </div>
  );
  const msg = error ? (
    <div className="bd-field-error-msg">{error}</div>
  ) : help ? (
    <div className="bd-field-help">{help}</div>
  ) : null;
  if (!label) {
    return (
      <>
        {wrapped}
        {msg}
      </>
    );
  }
  return (
    <label style={{ display: "block" }}>
      <span className="bd-label" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </span>
      {wrapped}
      {msg}
    </label>
  );
}
