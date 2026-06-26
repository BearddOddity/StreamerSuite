import React, { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ─── Sub-tab button ──────────────────────────────────────────────────────────
export function SubTabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 border cursor-pointer select-none whitespace-nowrap outline-none
        ${
          active
            ? "bg-[color-mix(in_srgb,var(--user-accent,#9146FF)_12%,transparent)] text-white border-[color-mix(in_srgb,var(--user-accent,#9146FF)_20%,transparent)] shadow-md shadow-[color-mix(in_srgb,var(--user-accent,#9146FF)_15%,transparent)]"
            : "bg-transparent text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.04]"
        }`}
    >
      <span className="text-sm leading-none">{icon}</span>
      {label}
    </button>
  );
}

// ─── Reusable Collapsible Section ───────────────────────────────────────────
export function CollapsibleSection({
  title,
  icon,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: string;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`border rounded-2xl transition-all duration-300 overflow-hidden mb-4 
        ${
          open
            ? "bg-black/45 border-white/15 shadow-xl shadow-black/30"
            : "bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/25"
        }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left cursor-pointer select-none focus:outline-none bg-transparent border-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-sm shrink-0">
              {icon}
            </span>
          )}
          <span className="text-xs font-semibold text-white/85 tracking-wide uppercase">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {badge && <div className="flex items-center">{badge}</div>}
          <div
            className={`w-6 h-6 rounded-lg bg-white/[0.03] flex items-center justify-center text-white/40 transition-all duration-300 ${
              open ? "rotate-180 bg-white/[0.06]" : ""
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open
            ? "grid-rows-[1fr] opacity-100 border-t border-white/[0.04]"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Premium Toggle ──────────────────────────────────────────────────────────
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-10 h-6 rounded-full relative shrink-0 transition-all duration-300 cursor-pointer outline-none border focus:ring-1 focus:ring-purple-500/30 ${
        on
          ? "bg-gradient-to-r from-purple-500 to-indigo-600 border-purple-400/40 shadow-md shadow-purple-500/20"
          : "bg-white/[0.07] border-white/10 hover:bg-white/[0.12] hover:border-white/15"
      }`}
    >
      <span
        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full shadow-md transition-all duration-300 ease-out ${
          on ? "left-[18px] bg-white scale-100" : "left-[3px] bg-white/50 scale-95"
        }`}
      />
    </button>
  );
}

// ─── Settings Form Row ──────────────────────────────────────────────────────
export function SettingsRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs text-white/70 font-medium">{label}</span>
        {description && <p className="text-[10px] text-white/35 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Settings Input ──────────────────────────────────────────────────────────
export function SettingsInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input-glass ${className || ""}`} {...props} />;
}

// ─── Settings Panel ─────────────────────────────────────────────────────────
export function SettingsPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`surface-card rounded-2xl p-6 mb-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Glass Select (custom dropdown) ─────────────────────────────────────────
interface GlassSelectOption {
  value: string;
  label: string;
  weight?: number;
}

export function GlassSelect({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useLayoutEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const trigger = (
    <div ref={ref} className={`glass-select-wrapper ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`glass-select-trigger ${open ? "open" : ""}`}
      >
        <span style={selected?.weight ? { fontWeight: selected.weight } : undefined}>
          {selected?.label ?? value}
        </span>
        <svg
          className={`glass-select-arrow ${open ? "rotated" : ""}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.4)" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );

  if (!open) return trigger;

  const menu = createPortal(
    <div
      ref={menuRef}
      className="glass-select-menu open"
      style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 9999 }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => { onChange(opt.value); setOpen(false); }}
          className={`glass-select-option ${opt.value === value ? "selected" : ""}`}
          style={opt.weight ? { fontWeight: opt.weight } : undefined}
        >
          {opt.label}
          {opt.value === value && (
            <svg className="glass-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>,
    document.body
  );

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}

// ─── Edit/Remove Button Pair ────────────────────────────────────────────────
export function EditRemoveButtons({
  isEditing,
  onToggleEdit,
  onRemove,
}: {
  isEditing: boolean;
  onToggleEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={onToggleEdit} className={`btn-icon-sm edit ${isEditing ? "active" : ""}`}>
        {isEditing ? "Close" : "Edit"}
      </button>
      <button onClick={onRemove} className="btn-icon-sm remove">Remove</button>
    </div>
  );
}
