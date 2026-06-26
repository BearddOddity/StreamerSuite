import type { ReactNode } from "react";
import type { SettingsTabId } from "@/hooks/useAppState";
import { SubTabBtn } from "./SettingsComponents";

interface Props {
  isOpen: boolean;
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  onClose: () => void;
  children: ReactNode;
}

const tabs: { id: SettingsTabId; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "engine", label: "Engine", icon: "⚡" },
  { id: "connections", label: "Connections", icon: "🔗" },
  { id: "apiKeys", label: "Connections & Keys", icon: "🔑" },
  { id: "theme", label: "Appearance", icon: "🎨" },
  { id: "about", label: "About", icon: "ℹ️" },
];

export default function SettingsModal({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  children,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="section-head">
            <span className="section-head-icon">⚙️</span>
            <div className="section-head-text">
              <h2 className="section-head-title">Settings</h2>
              <p className="section-head-desc">Configure your preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Sub-tab nav */}
        <div className="px-5 pt-3 pb-2 flex gap-2 shrink-0 border-b border-white/[0.04] flex-wrap">
          {tabs.map((tab) => (
            <SubTabBtn
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
