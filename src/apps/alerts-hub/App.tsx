import { useEffect, useState } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { useAlertsSettings } from "./useAlertsSettings";
import { useAlertsFeed } from "./useAlertsFeed";
import { SettingsPanel } from "./SettingsPanel";
import type { AlertEvent, AlertKind } from "./types";
import "../../design-system/styles.css";
import { Button, Card, SectionHead, StatusDot } from "../../design-system/components/core";
import { fetchConfig } from "@statusforge/hooks/useTauriApi";

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
  { platform: "chaturbate", kind: "tip", user: "BigFan", message: "sent a tip!", amount: "100" },
];
const ADULT_ALERT_PLATFORMS = ["joystick", "chaturbate"];

/** Maps the feed's 4-state connection status onto StatusDot's 3 visual states —
 *  "error" reads as "warn" since the shared dot has no red variant. */
function toDotStatus(status: "disconnected" | "connecting" | "live" | "error"): "on" | "off" | "warn" {
  if (status === "live") return "on";
  if (status === "connecting" || status === "error") return "warn";
  return "off";
}

export default function AlertsHubApp() {
  const { settings, update, toggle } = useAlertsSettings();
  const { alerts, push, clear, twitchAccount, refreshTwitchAccount, twitchStatus, kickStatus, joystickStatus, chaturbateStatus } = useAlertsFeed(settings);
  const [showSettings, setShowSettings] = useState(false);
  // Off by default (General -> Adult Content & Platforms) — zero mention of
  // Joystick.tv anywhere in this tool until it's explicitly turned on there.
  const [adultContentEnabled, setAdultContentEnabled] = useState(false);

  useEffect(() => {
    fetchConfig().then((cfg) => setAdultContentEnabled(!!cfg?.engine_settings.adult_content_enabled));
  }, []);

  const anyLive =
    twitchStatus === "live" ||
    kickStatus === "live" ||
    (adultContentEnabled && (joystickStatus === "live" || chaturbateStatus === "live"));
  const testEvents = adultContentEnabled
    ? TEST_EVENTS
    : TEST_EVENTS.filter((e) => !ADULT_ALERT_PLATFORMS.includes(e.platform));

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <SectionHead
            icon="🔔"
            title="Alerts & Events"
            desc={`${anyLive ? "🟢 Live — " : ""}Follows, subs, raids, cheers, and tips across Twitch, Kick${adultContentEnabled ? ", Joystick.tv, and Chaturbate" : ""}`}
            right={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => update({ soundEnabled: !settings.soundEnabled })}>
                  {settings.soundEnabled ? "🔊" : "🔇"}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowSettings(true)}>
                  ⚙ Settings
                </Button>
              </div>
            }
          />
        </div>

        <div className="flex items-center gap-4 mb-6">
          <span className="flex items-center gap-1.5"><PlatformIcon platform="twitch" size="xs" /><StatusDot status={toDotStatus(twitchStatus)} label={twitchStatus} /></span>
          <span className="flex items-center gap-1.5"><PlatformIcon platform="kick" size="xs" /><StatusDot status={toDotStatus(kickStatus)} label={kickStatus} /></span>
          {adultContentEnabled && (
            <>
              <span className="flex items-center gap-1.5"><PlatformIcon platform="joystick" size="xs" /><StatusDot status={toDotStatus(joystickStatus)} label={joystickStatus} /></span>
              <span className="flex items-center gap-1.5"><PlatformIcon platform="chaturbate" size="xs" /><StatusDot status={toDotStatus(chaturbateStatus)} label={chaturbateStatus} /></span>
            </>
          )}
        </div>

        {/* Quick trigger — local test alerts, doesn't touch any platform */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {testEvents.map((e, i) => (
            <button
              key={i}
              onClick={() => push(e)}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium border transition-all hover:-translate-y-0.5 ${KIND_STYLE[e.kind].color}`}
            >
              {KIND_STYLE[e.kind].icon} test {e.kind}
            </button>
          ))}
          {alerts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {alerts.length === 0 ? (
            <Card padding={24} className="text-center text-white/20 text-sm">
              No alerts yet. Connect a platform in Settings, or try a test alert above.
            </Card>
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
          chaturbateStatus={chaturbateStatus}
          adultContentEnabled={adultContentEnabled}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
