import { useState, useCallback } from "react";
import { getApps, getAppsByCategory, getApp } from "@/apps/registry";
import Launcher from "./Launcher";
import TopBar from "./TopBar";
import MainSettingsPage from "@/components/settings/MainSettingsPage";
import type { SettingsTabId } from "@/components/settings/MainSettingsPage";
import EmbeddedMultiChat from "@/apps/multi-chat/EmbeddedMultiChat";
import { openAppInNewWindow } from "./popout";

const MAIN_SETTINGS_ID = "__main-settings__";
const MULTI_CHAT_ID = "multi-chat";

export default function AppShell() {
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(true);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("apiKeys");

  const handleLaunchApp = useCallback((id: string) => {
    setActiveAppId(id);
    setLauncherOpen(false);
  }, []);

  const handleOpenLauncher = useCallback(() => {
    setLauncherOpen(true);
    setActiveAppId(null);
  }, []);

  const openSettings = useCallback((tab?: SettingsTabId) => {
    if (tab) setSettingsTab(tab);
    setActiveAppId(MAIN_SETTINGS_ID);
    setLauncherOpen(false);
  }, []);

  const activeApp = activeAppId && activeAppId !== MAIN_SETTINGS_ID ? getApp(activeAppId) : null;
  const ActiveComponent = activeApp?.component;
  const isMainSettings = activeAppId === MAIN_SETTINGS_ID;
  const isMultiChat = !launcherOpen && activeAppId === MULTI_CHAT_ID;

  const handlePopOutActiveApp = useCallback(() => {
    if (!activeApp) return;
    openAppInNewWindow(activeApp.id, activeApp.name);
    handleOpenLauncher();
  }, [activeApp, handleOpenLauncher]);

  const categories = [
    { id: "chat", label: "Chat" },
    { id: "tools", label: "Tools" },
    { id: "alerts", label: "Alerts" },
    { id: "media", label: "Media" },
    { id: "utilities", label: "Utilities" },
  ] as const;

  return (
    <div className="flex flex-col h-screen w-screen text-white/80 font-sans overflow-hidden">
      <TopBar
        activeAppId={activeAppId}
        onOpenLauncher={handleOpenLauncher}
        onOpenSettings={() => openSettings()}
        onPopOutActiveApp={handlePopOutActiveApp}
      />
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {isMainSettings ? (
          <MainSettingsPage initialTab={settingsTab} onBack={handleOpenLauncher} />
        ) : launcherOpen ? (
          <Launcher
            apps={getApps()}
            categories={categories.map((c) => ({ ...c, apps: getAppsByCategory(c.id) }))}
            onLaunch={handleLaunchApp}
          />
        ) : ActiveComponent && activeAppId !== MULTI_CHAT_ID ? (
          <ActiveComponent />
        ) : null}
        {/* Always mounted (never unmounted on navigation, only hidden) so its
            chat connections stay alive in the background exactly like a
            real second window would — matching what navigating away from a
            standalone Multi-Chat window used to do. */}
        <div className={isMultiChat ? "absolute inset-0" : "hidden"}>
          <EmbeddedMultiChat />
        </div>
      </div>
    </div>
  );
}
