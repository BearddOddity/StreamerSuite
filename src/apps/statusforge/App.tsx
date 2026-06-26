import React, { useState, useCallback, useMemo } from "react";
import type { ViewId } from "./types";
import { useMockEngine, useMockLibrary } from "./hooks/useMockData";
import { useToasts } from "./hooks/useToasts";
import { ToastContainer } from "./components/Toast";

import DashboardView from "./views/DashboardView";
import EngineConfigView from "./views/EngineConfigView";
import ApiKeysView from "./views/ApiKeysView";
import RoutingView from "./views/RoutingView";
import LibraryView from "./LibraryView";
import SettingsView from "./SettingsView";
import DevView from "./dev/DevView";

export default function StatusForgeApp() {
  console.log("[StatusForge] App rendering");
  const [currentView, setCurrentView] = useState<ViewId>("dashboard");
  const [devUnlocked, setDevUnlocked] = useState(false);
  const { toasts, add: toast } = useToasts();
  const { status: engineStatus, wsConnected, startEngine, stopEngine } = useMockEngine();
  const { library, exiled, reload: reloadLibrary } = useMockLibrary();

  const handleDevUnlock = useCallback(() => {
    setDevUnlocked(true);
    toast("🔓 Dev Tools unlocked", "info");
  }, [toast]);

  const NavButton = useCallback(
    ({ id, label, icon }: { id: ViewId; label: string; icon: string }) => (
      <button
        className={`nav-item ${currentView === id ? "nav-item-active" : ""}`}
        onClick={() => setCurrentView(id)}
      >
        <span className="nav-item-icon">{icon}</span>
        <span className="nav-item-label">{label}</span>
      </button>
    ),
    [currentView]
  );

  const views = useMemo(
    () => ({
      dashboard: (
        <DashboardView
          engineStatus={engineStatus}
          wsConnected={wsConnected}
          toast={toast}
        />
      ),
      settings: (
        <SettingsView
          engineStatus={engineStatus}
          onRefresh={() => {}}
          toast={toast}
          devUnlocked={devUnlocked}
        />
      ),
      library: (
        <LibraryView
          toast={toast}
          library={library}
          exiled={exiled}
          onReload={reloadLibrary}
        />
      ),
      dev: <DevView />,
    }),
    [engineStatus, wsConnected, toast, devUnlocked, library, exiled, reloadLibrary]
  );

  return (
    <div className="flex h-full w-full bg-[#050505] text-white/80 font-sans">
      {/* Sidebar */}
      <nav className="sidebar-glass flex flex-col px-3 py-5 z-10 w-[240px] shrink-0">
        <div className="px-3 pb-5 text-center">
          <div className="text-2xl font-bold text-white/90 tracking-tight">StatusForge</div>
          <div
            className="badge badge-ghost mt-3 mx-auto w-fit cursor-pointer select-none"
            onClick={handleDevUnlock}
            title="StatusForge"
          >
            v1.0.8
          </div>
        </div>

        <NavButton id="dashboard" label="Status Room" icon="⏳" />
        <NavButton id="library" label="Library" icon="📚" />
        <NavButton id="settings" label="Settings" icon="⚙️" />

        {devUnlocked && <NavButton id="dev" label="Dev Tools" icon="🛠" />}

        <div className="flex-grow" />

        <div className="divider mb-3" />
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
          <span
            className={`status-dot ${engineStatus.running ? "on" : "off"}`}
            style={{ animation: engineStatus.running ? "var(--user-status-pulse, pulse 2s ease-in-out infinite)" : "none" }}
          />
          <span className="text-[11px] text-white/40 font-medium truncate">
            {engineStatus.running ? "Engine Online" : "Engine Offline"}
          </span>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden h-full min-w-0 flex flex-col">
        <ToastContainer toasts={toasts} />
        {views[currentView]}
      </main>
    </div>
  );
}
