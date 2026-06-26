import type React from "react";

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card-glass mb-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Btn ──────────────────────────────────────────────────────────────────────

export function Btn({
  children,
  variant = "primary",
  disabled,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    "px-4 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border";
  const variants = {
    primary:
      "bg-white/[0.06] border-white/10 text-white/75 hover:bg-white/[0.1] hover:border-white/15 hover:text-white hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20",
    danger:
      "bg-red-500/10 border-red-500/20 text-red-400/80 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 hover:-translate-y-0.5 hover:shadow-md hover:shadow-red-500/10",
    ghost:
      "bg-transparent border-white/[0.06] text-white/45 hover:bg-white/[0.04] hover:border-white/10 hover:text-white/70",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

export function Tag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "twitch" | "kick" | "sb";
}) {
  const variants: Record<string, string> = {
    default: "bg-white/10 text-white/60",
    twitch: "bg-purple-500/20 text-purple-400",
    kick: "bg-emerald-500/20 text-emerald-400",
    sb: "bg-amber-500/20 text-amber-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
