import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import type { AlertsSettings, TwitchAccount } from "./types";
import { Button, Card, Chip, StatusDot } from "../../design-system/components/core";

type ConnStatus = "disconnected" | "connecting" | "live" | "error";

/** Maps the feed's 4-state connection status onto StatusDot's 3 visual states —
 *  "error" reads as "warn" since the shared dot has no red variant. */
function toDotStatus(status: ConnStatus): "on" | "off" | "warn" {
  if (status === "live") return "on";
  if (status === "connecting" || status === "error") return "warn";
  return "off";
}

export function SettingsPanel({
  settings,
  onUpdate,
  onToggle,
  twitchAccount,
  onTwitchAccountChange,
  twitchStatus,
  kickStatus,
  joystickStatus,
  onClose,
}: {
  settings: AlertsSettings;
  onUpdate: (patch: Partial<AlertsSettings>) => void;
  onToggle: (key: keyof AlertsSettings["enabled"]) => void;
  twitchAccount: TwitchAccount | null;
  onTwitchAccountChange: () => void;
  twitchStatus: ConnStatus;
  kickStatus: ConnStatus;
  joystickStatus: ConnStatus;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  async function connectTwitch() {
    setConnecting(true);
    setError("");
    try {
      await invoke("alerts_oauth_login", { clientId, clientSecret });
      onTwitchAccountChange();
      setClientSecret("");
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectTwitch() {
    await invoke("alerts_oauth_logout");
    onTwitchAccountChange();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <Card padding={24} className="w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-white/90">Alert Settings</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        {/* Twitch */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="twitch" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Twitch</span>
            <StatusDot status={toDotStatus(twitchStatus)} />
          </div>
          {twitchAccount ? (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2">
              <span className="text-[12px] text-white/70">Connected as <b>{twitchAccount.username}</b></span>
              <button onClick={disconnectTwitch} className="text-[11px] text-red-400 hover:text-red-300">Disconnect</button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID"
                className="w-full input-glass text-[12px]"
              />
              <input
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client Secret"
                type="password"
                className="w-full input-glass text-[12px]"
              />
              <Button
                variant="cta"
                className="w-full"
                disabled={connecting || !clientId || !clientSecret}
                onClick={connectTwitch}
              >
                {connecting ? "Connecting…" : "Connect Twitch"}
              </Button>
              {error && <p className="text-[10px] text-red-400">{error}</p>}
              <p className="text-[10px] text-white/30">
                Register an app at dev.twitch.tv/console/apps with OAuth redirect URL{" "}
                <code className="text-white/40">http://localhost:61840/callback</code>.
              </p>
            </div>
          )}
          {twitchAccount && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(["twitchFollow", "twitchSub", "twitchRaid", "twitchCheer"] as const).map((k) => (
                <Chip key={k} selected={settings.enabled[k]} onClick={() => onToggle(k)}>
                  {k.replace("twitch", "")}
                </Chip>
              ))}
            </div>
          )}
        </section>

        {/* Kick */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="kick" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Kick</span>
            <StatusDot status={toDotStatus(kickStatus)} />
          </div>
          <input
            value={settings.kickSlug}
            onChange={(e) => onUpdate({ kickSlug: e.target.value })}
            placeholder="channel slug (e.g. beardds)"
            className="w-full input-glass text-[12px]"
          />
          <p className="text-[10px] text-white/30 mt-1">
            No login needed — subs, gifted subs, and hosts are public on Kick's channel feed.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["kickSub", "kickHost"] as const).map((k) => (
              <Chip key={k} selected={settings.enabled[k]} onClick={() => onToggle(k)}>
                {k.replace("kick", "")}
              </Chip>
            ))}
          </div>
        </section>

        {/* Joystick */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="joystick" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Joystick.tv</span>
            <StatusDot status={toDotStatus(joystickStatus)} />
          </div>
          <p className="text-[10px] text-white/30">
            Uses the same Joystick.tv bot connection as Multi-Chat — connect it there first. Tips show up here as alerts.
          </p>
          <div className="mt-2">
            <Chip selected={settings.enabled.joystickTip} onClick={() => onToggle("joystickTip")}>
              Tips
            </Chip>
          </div>
        </section>

        <section>
          <button
            onClick={() => onUpdate({ soundEnabled: !settings.soundEnabled })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08]"
          >
            <span className="text-[12px] text-white/70">Alert sound</span>
            <span className="text-[12px]">{settings.soundEnabled ? "🔊 On" : "🔇 Off"}</span>
          </button>
        </section>
      </Card>
    </div>
  );
}
