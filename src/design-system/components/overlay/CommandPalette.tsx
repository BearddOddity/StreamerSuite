import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Kbd } from "../core/Kbd";

export interface CommandItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Trailing category tag, e.g. "Maker" or "Browse". */
  sub?: string;
  /** Trailing keyboard-shortcut hint instead of `sub`, e.g. ["⌘", "P"]. */
  kbd?: string[];
  onSelect: () => void;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
  className?: string;
}

/** CommandPalette — ⌘K-style search-everything overlay. Type to filter by
 *  label, arrow keys to move, Enter to run, Escape to close. */
export function CommandPalette({ open, onClose, groups, placeholder = "Type a command or search…", className = "" }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const flatItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);

  if (!open) return null;

  const commit = (item: CommandItem | undefined) => {
    if (!item) return;
    item.onSelect();
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        commit(flatItems[activeIndex]);
        break;
      default:
        break;
    }
  };

  let runningIndex = -1;

  return (
    <div
      className="bd-cmdk-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`bd-cmdk ${className}`.trim()} role="dialog" aria-modal="true" onKeyDown={onKeyDown}>
        <div className="bd-cmdk-input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
          <Kbd keys={["Esc"]} />
        </div>
        {filteredGroups.map((g) => (
          <div key={g.label}>
            <div className="bd-cmdk-group-label">{g.label}</div>
            {g.items.map((it) => {
              runningIndex += 1;
              const isActive = runningIndex === activeIndex;
              return (
                <div
                  key={it.id}
                  className={`bd-cmdk-item ${isActive ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(runningIndex)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(it);
                  }}
                >
                  {it.icon != null && <span className="bd-cmdk-item-icon">{it.icon}</span>}
                  <span className="bd-cmdk-item-label">{it.label}</span>
                  {it.sub != null && <span className="bd-cmdk-item-sub">{it.sub}</span>}
                  {it.kbd != null && <Kbd keys={it.kbd} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
