import { useState } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { useAlertsSettings } from "./useAlertsSettings";
import { useAlertsFeed } from "./useAlertsFeed";
import { SettingsPanel } from "./SettingsPanel";
import type { AlertEvent, AlertKind } from "./types";

const KIND_STYLE: Record<AlertKind, { icon: string; color: string }> = {
  follow: { icon: "💜", color: "border-purple-500/25 bg-purple-500/10" },
  sub: { icon: "⭐", color: "border-amber-500/25 bg-amber-500/10" },
  raid: { icon: "🚀", color: "border-cyan-500/25 bg-cyan-500/10" },
  cheer: { icon: "💎", color: "border-pink-500/25 bg-pink-500/10" },
  tip: { icon: "💰", color: "border-green-500/25 bg-green-500/10" },
};

const TEST_EVENTS: Omit<AlertEvent, "id" | "timestamp">[] = [
  { platform: "twitch", kind: "follow", user: "StreamFan42", message: "just followed!" },
  { platform: "twitch", kind: "sub", user: "ProGamer99", message: "subscribed (tier 1)!" },
  { platform: "twitch", kind: "raid", user: "AnotherStreamer", message: "is raiding with 45 viewers!", amount: "45" },
  { platform: "twitch", kind: "cheer", user: "GenerousViewer", message: "cheered 500 bits!", amount: "500" },
  { platform: "kick", kind: "sub", user: "LoyalSub", message: "gifted 5 subs!", amount: "5" },
  { platform: "joystick", kind: "tip", user: "BigFan", message: "sent a tip!", amount: "100" },
];

export default function AlertsHubApp() {
  const { settings, update, toggle } = useAlertsSettings();
  const { alerts, push, clear, twitchAccount, refreshTwitchAccount, twitchStatus, kickStatus, joystickStatus } = useAlertsFeed(settings);
  const [showSettings, setShowSettings] = useState(false);

  const anyLive = twitchStatus === "live" || kickStatus === "live" || joystickStatus === "live";

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Alerts & Events</h2>
            <p className="text-[11px] text-white/30 mt-0.5">
              {anyLive ? "🟢 Live — " : ""}Follows, subs, raids, cheers, and tips across Twitch, Kick, and Joystick.tv
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => update({ soundEnabled: !settings.soundEnabled })}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all border bg-white/[0.04] text-white/50 border-white/[0.08]"
            >
              {settings.soundEnabled ? "🔊" : "🔇"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all border bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08]"
            >
              ⚙ Settings
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 text-[10px] text-white/30">
          <span className="flex items-center gap-1"><PlatformIcon platform="twitch" size="xs" /> {twitchStatus}</span>
          <span className="flex items-center gap-1"><PlatformIcon platform="kick" size="xs" /> {kickStatus}</span>
          <span className="flex items-center gap-1"><PlatformIcon platform="joystick" size="xs" /> {joystickStatus}</span>
        </div>

        {/* Quick trigger — local test alerts, doesn't touch any platform */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TEST_EVENTS.map((e, i) => (
            <button
              key={i}
              onClick={() => push(e)}
              className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all hover:-translate-y-0.5 ${KIND_STYLE[e.kind].color}`}
            >
              {KIND_STYLE[e.kind].icon} test {e.kind}
            </button>
          ))}
          {alerts.length > 0 && (
            <button onClick={clear} className="px-3 py-2 rounded-xl text-[11px] font-medium border border-white/[0.08] text-white/40 hover:text-white/70">
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-white/20 text-sm">
              No alerts yet. Connect a platform in Settings, or try a test alert above.
            </div>
          ) : (
            alerts.map((alert) => {
              const style = KIND_STYLE[alert.kind];
              return (
                <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${style.color}`}>
                  <span className="text-xl">{style.icon}</span>
                  <PlatformIcon platform={alert.platform} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold text-white/80">{alert.user}</span>
                    <span className="text-[11px] text-white/40 ml-1">{alert.message}</span>
                  </div>
                  <span className="text-[9px] text-white/15 shrink-0">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={update}
          onToggle={toggle}
          twitchAccount={twitchAccount}
          onTwitchAccountChange={refreshTwitchAccount}
          twitchStatus={twitchStatus}
          kickStatus={kickStatus}
          joystickStatus={joystickStatus}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
