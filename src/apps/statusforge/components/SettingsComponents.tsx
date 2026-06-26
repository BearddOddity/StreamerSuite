import React, { type ReactNode, useState } from "react";

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer border ${
        on
          ? "bg-[var(--accent-system)]/30 border-[var(--accent-system)]/40"
          : "bg-white/[0.06] border-white/[0.1]"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
          on
            ? "left-[18px] bg-[var(--accent-system)]"
            : "left-0.5 bg-white/40"
        }`}
      />
    </button>
  );
}

export function CollapsibleSection({
  title,
  description,
  icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  description?: string;
  icon?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl cursor-pointer hover:bg-white/[0.04] transition-all text-left"
      >
        {icon && <span className="text-lg">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/90">{title}</span>
            {badge}
          </div>
          {description && (
            <p className="text-[10px] text-white/35 mt-0.5">{description}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-white/30 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function SubTabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 border cursor-pointer select-none whitespace-nowrap outline-none ${active ? "bg-purple-500/15 text-purple-300 border-purple-500/25 shadow-md shadow-purple-500/5" : "bg-transparent text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.04]"}`}>
      <span className="text-sm leading-none">{icon}</span>{label}
    </button>
  );
}

export function SettingsRow({ label, description, children }: {
  label: string; description?: string; children: ReactNode;
}) {
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

export function SettingsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input-glass ${props.className || ""}`} {...props} />;
}

export function SettingsPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface-card rounded-2xl p-6 mb-5 ${className}`}>{children}</div>;
}

export function EditRemoveButtons({ isEditing, onToggleEdit, onRemove }: {
  isEditing: boolean; onToggleEdit: () => void; onRemove: () => void;
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
