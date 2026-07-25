import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

export interface MenuItem {
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
  menuStyle?: CSSProperties;
}

/** Menu — kebab/context dropdown. `trigger` is whatever opens it (an icon button, a row, …). */
export function Menu({ trigger, items, align = "start", className = "", menuStyle }: MenuProps) {
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

  const selectable = items.map((it, i) => ({ ...it, i })).filter((it) => !it.divider && !it.disabled);

  const commit = (item: MenuItem | undefined) => {
    if (!item || item.disabled || item.divider) return;
    item.onClick?.();
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(selectable[0] ? selectable[0].i : -1);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown": {
        e.preventDefault();
        const next = selectable.find((it) => it.i > focusedIndex);
        setFocusedIndex(next ? next.i : selectable[0] ? selectable[0].i : -1);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevItems = selectable.filter((it) => it.i < focusedIndex);
        const prev = prevItems[prevItems.length - 1];
        setFocusedIndex(prev ? prev.i : selectable[selectable.length - 1] ? selectable[selectable.length - 1]!.i : -1);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        commit(items[focusedIndex]);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`bd-menu-wrap ${className}`.trim()} ref={wrapRef} onKeyDown={onKeyDown}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      <ul className={`glass-menu bd-menu-list bd-menu-${align} ${open ? "open" : ""}`} role="menu" style={menuStyle}>
        {items.map((it, i) =>
          it.divider ? (
            <li key={i} className="bd-menu-divider" role="separator" />
          ) : (
            <li
              key={i}
              role="menuitem"
              aria-disabled={it.disabled}
              className={`glass-option bd-menu-item ${i === focusedIndex ? "focused" : ""} ${it.danger ? "bd-menu-item-danger" : ""}`}
              style={it.disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                commit(it);
              }}
              onMouseEnter={() => !it.disabled && setFocusedIndex(i)}
            >
              {it.icon != null && <span className="bd-menu-item-icon">{it.icon}</span>}
              <span style={{ flex: 1 }}>{it.label}</span>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
