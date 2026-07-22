import { useState } from "react";
import { useSharedSettings } from "@/settings";
import GeneralTab from "./GeneralTab";
import ApiKeysTab from "./ApiKeysTab";
import ThemeTab from "./ThemeTab";
import EngineTab from "./EngineTab";
import AboutTab from "./AboutTab";
import { SubTabBtn } from "./SettingsComponents";

export type SettingsTabId = "general" | "engine" | "apiKeys" | "theme" | "about";

interface Props {
  initialTab?: SettingsTabId;
  onBack: () => void;
}

const tabs: { id: SettingsTabId; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "engine", label: "Engine", icon: "⚡" },
  { id: "apiKeys", label: "Connections & Keys", icon: "🔑" },
  { id: "theme", label: "Appearance", icon: "🎨" },
  { id: "about", label: "About", icon: "ℹ️" },
];

export default function MainSettingsPage({ initialTab, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab ?? "general");
  const settings = useSharedSettings();

  return (
    <div className="flex flex-col h-full w-full bg-bg-primary">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all shrink-0"
            title="Back to Launcher"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="section-head-icon">⚙️</div>
          <div>
            <h1 className="text-[18px] font-bold text-white/90 tracking-tight">Settings</h1>
            <p className="text-[11px] text-white/30">Configure your preferences</p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <SubTabBtn
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === "general" && (
          <GeneralTab
            {...settings.system}
            onFieldChange={settings.updateSystem}
          />
        )}
        {activeTab === "engine" && (
          <EngineTab
            engine={settings.engine}
            detection={settings.detection}
            devUnlocked={settings.detection.devToolsEnabled}
            onEngineChange={settings.updateEngine}
            onDetectionChange={settings.updateDetection}
          />
        )}
        {activeTab === "apiKeys" && <ApiKeysTab />}
        {activeTab === "theme" && (
          <ThemeTab
            {...settings.theme}
            onFieldChange={settings.updateTheme}
          />
        )}
        {activeTab === "about" && <AboutTab version="0.1.0" />}
      </div>
    </div>
  );
}
