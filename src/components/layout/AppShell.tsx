import type { ReactNode } from "react";

interface Props {
  sidebarOpen: boolean;
  sidebar: ReactNode;
  main: ReactNode;
  settingsModal: ReactNode | null;
  addChannelModal: ReactNode | null;
}

export default function AppShell({
  sidebarOpen,
  sidebar,
  main,
  settingsModal,
  addChannelModal,
}: Props) {
  return (
    <div className="flex h-screen w-screen bg-bg-primary text-white/80 font-sans">
      {/* Sidebar */}
      <div
        className={`shrink-0 flex flex-col h-full transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden"
        }`}
      >
        {sidebar}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {main}
      </div>

      {/* Overlays */}
      {settingsModal}
      {addChannelModal}
    </div>
  );
}
