import { SharedSettingsProvider } from "@/settings";
import { getApp } from "@/apps/registry";

// Rendered instead of the normal AppShell when this window was opened via
// openAppInNewWindow (main.tsx checks for ?popout=<id>) — just the one
// app's component, filling the whole window, no launcher/TopBar chrome.
export default function PopoutShell({ appId }: { appId: string }) {
  const app = getApp(appId);
  const Component = app?.component;

  return (
    <SharedSettingsProvider>
      <div className="h-screen w-screen overflow-hidden text-white/80 font-sans">
        {Component ? (
          <Component />
        ) : (
          <div className="h-full flex items-center justify-center text-white/40 text-sm">
            Unknown app: {appId}
          </div>
        )}
      </div>
    </SharedSettingsProvider>
  );
}
