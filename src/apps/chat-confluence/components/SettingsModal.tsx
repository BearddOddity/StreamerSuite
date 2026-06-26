import type { ReactNode } from "react";
import type { SettingsTabId } from "../hooks/useAppState";

interface Props {
  isOpen: boolean;
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  onClose: () => void;
  children: ReactNode;
}

const tabs: { id: SettingsTabId; label: string; icon: string }[] = [
  { id: "connections", label: "Connections", icon: "🔗" },
  { id: "theme", label: "Theme", icon: "🎨" },
  { id: "about", label: "About", icon: "ℹ️" },
];

export default function SettingsModal({ isOpen, activeTab, onTabChange, onClose, children }: Props) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center animate-float-backdrop">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-[580px] max-h-[85vh] bg-[#0a0a0f]/95 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl animate-float-card-in flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-0 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <span className="text-white/40 text-sm">⚙️</span>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white/90">Settings</h2>
              <p className="text-[10px] text-white/30">Configure your preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all text-xs">✕</button>
        </div>
        <div className="px-5 pt-4 pb-2 flex gap-2 shrink-0">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer select-none whitespace-nowrap outline-none ${
                activeTab === tab.id
                  ? "bg-[var(--accent-system)]/12 text-[var(--accent-system)] border-[var(--accent-system)]/25 shadow-md shadow-[var(--accent-system)]/5"
                  : "bg-transparent text-white/35 border-transparent hover:text-white/60 hover:bg-white/[0.04]"
              }`}>
              <span className="text-[13px] leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}
