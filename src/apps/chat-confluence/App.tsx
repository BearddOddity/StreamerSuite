import { useMemo } from "react";
import { useDummyData } from "./hooks/useDummyData";
import { useAppState } from "./hooks/useAppState";
import { useSharedSettings } from "@/settings";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import AddChannelModal from "./components/AddChannelModal";
import SettingsModal from "./components/SettingsModal";
import ConnectionsTab from "./components/ConnectionsTab";
import ThemeTab from "./components/ThemeTab";
import AboutTab from "./components/AboutTab";
import type { Platform } from "./types";

export default function ChatConfluenceApp() {
  const chat = useDummyData();
  const appState = useAppState();
  const settings = useSharedSettings();
  const t = settings.theme;

  const activeChannelData = useMemo(
    () => chat.channels.find((c) => `${c.platform}:${c.channelId}` === chat.activeChannel),
    [chat.channels, chat.activeChannel]
  );

  const filteredMessages = useMemo(() => {
    if (chat.isMultiChat) return [...chat.messages].sort((a, b) => a.timestamp - b.timestamp);
    if (!chat.activeChannel) return [];
    const [plat] = chat.activeChannel.split(":") as [Platform, string];
    return chat.messages.filter((m) => m.platform === plat);
  }, [chat.messages, chat.activeChannel, chat.isMultiChat]);

  const multiChannels = useMemo(
    () => chat.channels.filter((c) => c.isConnected),
    [chat.channels]
  );

  const handleAddChannel = (platform: Platform, channelId: string, channelName: string) => {
    chat.connectChannel(platform, channelId, channelName);
    if (!chat.isMultiChat) chat.setActiveChannel(`${platform}:${channelId}`);
  };

  const handleToggleMultiChat = () => {
    chat.setIsMultiChat(!chat.isMultiChat);
    if (!chat.isMultiChat && chat.channels.length > 0) chat.setActiveChannel(null);
  };

  const mainContent = chat.isMultiChat ? (
    <ChatPanel
      messages={filteredMessages}
      channelName={`Multi-Chat (${multiChannels.length} channels)`}
      platform={null}
      isConnected={multiChannels.length > 0}
      onSendMessage={chat.sendMessage}
      isMultiChat
      connectedChannels={multiChannels}
      sidebarOpen={appState.sidebarOpen}
      onToggleSidebar={appState.toggleSidebar}
    />
  ) : activeChannelData ? (
    <ChatPanel
      messages={filteredMessages}
      channelName={activeChannelData.channelName}
      platform={activeChannelData.platform}
      channelId={activeChannelData.channelId}
      isConnected={activeChannelData.isConnected}
      onSendMessage={chat.sendMessage}
      sidebarOpen={appState.sidebarOpen}
      onToggleSidebar={appState.toggleSidebar}
    />
  ) : (
    <div className="flex-1 flex items-center justify-center bg-bg-chat">
      <div className="text-center">
        <div className="text-5xl mb-4 opacity-10">💬</div>
        <p className="text-white/30 text-sm">Select a channel or enable multi-chat</p>
        <p className="text-white/15 text-xs mt-2">
          {chat.channels.length === 0 ? "Add channels from the sidebar" : "Choose a channel above"}
        </p>
      </div>
    </div>
  );

  const settingsContent = (
    <SettingsModal
      isOpen={appState.settingsOpen}
      activeTab={appState.settingsTab}
      onTabChange={appState.setSettingsTab}
      onClose={appState.closeSettings}
    >
      {appState.settingsTab === "connections" && (
        <ConnectionsTab channels={chat.channels} onSetConnectionMode={chat.setChannelConnectionMode} />
      )}
      {appState.settingsTab === "theme" && (
        <ThemeTab
          accentColor={t.accentColor} onAccentChange={(v) => settings.updateTheme("accentColor", v)}
          themeMode={t.themeMode} onThemeModeChange={(v) => settings.updateTheme("themeMode", v)}
          fontSize={t.fontSize} onFontSizeChange={(v) => settings.updateTheme("fontSize", v)}
          chatDensity={t.chatDensity} onChatDensityChange={(v) => settings.updateTheme("chatDensity", v)}
          borderRadius={t.borderRadius === "sharp" ? 0 : t.borderRadius === "soft" ? 8 : 16}
          onBorderRadiusChange={(v) => settings.updateTheme("borderRadius", v === 0 ? "sharp" : v <= 8 ? "soft" : "rounded")}
          showTimestamps={t.showTimestamps} onShowTimestampsChange={(v) => settings.updateTheme("showTimestamps", v)}
          showBadges={t.showBadges} onShowBadgesChange={(v) => settings.updateTheme("showBadges", v)}
          animationsEnabled={t.animationsEnabled} onAnimationsEnabledChange={(v) => settings.updateTheme("animationsEnabled", v)}
          glowEffects={t.glowEffects} onGlowEffectsChange={(v) => settings.updateTheme("glowEffects", v)}
        />
      )}
      {appState.settingsTab === "about" && <AboutTab version="0.2.0" />}
    </SettingsModal>
  );

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <div className={`shrink-0 flex flex-col h-full transition-all duration-300 ease-in-out ${
        appState.sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden"
      }`}>
        <Sidebar
          channels={chat.channels}
          activeChannel={chat.activeChannel}
          isMultiChat={chat.isMultiChat}
          onSelectChannel={chat.setActiveChannel}
          onAddChannel={appState.openModal}
          onDisconnect={chat.disconnectChannel}
          onToggleMultiChat={handleToggleMultiChat}
          onOpenSettings={() => appState.openSettings("connections")}
          onToggleSidebar={appState.toggleSidebar}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {mainContent}
        {settingsContent}
        <AddChannelModal
          isOpen={appState.modalOpen}
          onClose={appState.closeModal}
          onAdd={handleAddChannel}
        />
      </div>
    </div>
  );
}
