import { useState, useCallback } from "react";

export type SettingsTabId = "general" | "engine" | "apiKeys" | "routing" | "connections" | "theme" | "about";

export function useAppState() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("connections");
  const [modalOpen, setModalOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const openSettings = useCallback((tab?: SettingsTabId) => {
    if (tab) setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return {
    sidebarOpen, toggleSidebar,
    settingsOpen, settingsTab, setSettingsTab, openSettings, closeSettings,
    modalOpen, openModal, closeModal,
  };
}
