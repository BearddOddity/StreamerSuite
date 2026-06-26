import { useState } from "react";
import { useTheme } from "@/hooks/ThemeContext";
import ApiKeysTab from "./ApiKeysTab";
import RoutingTab from "./RoutingTab";
import ConnectionsTab from "./ConnectionsTab";
import ThemeTab from "./ThemeTab";
import AboutTab from "./AboutTab";
import type { SettingsTabId } from "@/hooks/useAppState";

interface Props {
  initialTab?: SettingsTabId;
  onBack: () => void;
}

const tabs: { id: SettingsTabId; label: string; icon: string }[] = [
  { id: "apiKeys", label: "Platform & Keys", icon: "🔑" },
  { id: "routing", label: "Routing", icon: "🔀" },
  { id: "connections", label: "Connections", icon: "🔗" },
  { id: "theme", label: "General", icon: "⚙️" },
  { id: "about", label: "About", icon: "ℹ️" },
];

export default function MainSettingsPage({ initialTab = "apiKeys", onBack }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const theme = useTheme();

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
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <span className="text-white/40 text-sm">⚙️</span>
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-white/90 tracking-tight">Settings</h1>
            <p className="text-[11px] text-white/30">Configure your preferences</p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer select-none whitespace-nowrap outline-none ${
                activeTab === tab.id
                  ? "bg-[var(--accent-system)]/12 text-[var(--accent-system)] border-[var(--accent-system)]/25 shadow-md shadow-[var(--accent-system)]/5"
                  : "bg-transparent text-white/35 border-transparent hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-[13px] leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === "apiKeys" && <ApiKeysTab />}
        {activeTab === "routing" && <RoutingTab />}
        {activeTab === "connections" && (
          <ConnectionsTab channels={[]} onSetConnectionMode={() => {}} />
        )}
        {activeTab === "theme" && (
          <ThemeTab
            accentColor={theme.accentColor} onAccentChange={theme.setAccentColor}
            themeMode={theme.themeMode} onThemeModeChange={theme.setThemeMode}
            fontSize={theme.fontSize} onFontSizeChange={theme.setFontSize}
            chatDensity={theme.chatDensity} onChatDensityChange={theme.setChatDensity}
            borderRadius={theme.borderRadius} onBorderRadiusChange={theme.setBorderRadius}
            showTimestamps={theme.showTimestamps} onShowTimestampsChange={theme.setShowTimestamps}
            showBadges={theme.showBadges} onShowBadgesChange={theme.setShowBadges}
            animationsEnabled={theme.animationsEnabled} onAnimationsEnabledChange={theme.setAnimationsEnabled}
            glowEffects={theme.glowEffects} onGlowEffectsChange={theme.setGlowEffects}
            launchOnStartup={theme.launchOnStartup} onLaunchOnStartupChange={theme.setLaunchOnStartup}
            notificationsEnabled={theme.notificationsEnabled} onNotificationsEnabledChange={theme.setNotificationsEnabled}
            language={theme.language} onLanguageChange={theme.setLanguage}
          />
        )}
        {activeTab === "about" && <AboutTab version="0.1.0" />}
      </div>
    </div>
  );
}
