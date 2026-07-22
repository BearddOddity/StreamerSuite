import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import type { AlertsSettings, TwitchAccount } from "./types";

type ConnStatus = "disconnected" | "connecting" | "live" | "error";

function StatusDot({ status }: { status: ConnStatus }) {
  const color =
    status === "live" ? "bg-green-400" : status === "connecting" ? "bg-amber-400 animate-pulse" : status === "error" ? "bg-red-400" : "bg-white/20";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
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
      <div
        className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-white/90">Alert Settings</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-sm">✕</button>
        </div>

        {/* Twitch */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="twitch" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Twitch</span>
            <StatusDot status={twitchStatus} />
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
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
              />
              <input
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client Secret"
                type="password"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
              />
              <button
                onClick={connectTwitch}
                disabled={connecting || !clientId || !clientSecret}
                className="w-full py-2 rounded-lg text-[12px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25 hover:bg-purple-500/25 transition-all disabled:opacity-40"
              >
                {connecting ? "Connecting…" : "Connect Twitch"}
              </button>
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
                <button
                  key={k}
                  onClick={() => onToggle(k)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                    settings.enabled[k] ? "bg-purple-500/10 text-purple-300 border-purple-500/25" : "bg-white/[0.02] text-white/25 border-white/[0.06]"
                  }`}
                >
                  {k.replace("twitch", "")}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Kick */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="kick" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Kick</span>
            <StatusDot status={kickStatus} />
          </div>
          <input
            value={settings.kickSlug}
            onChange={(e) => onUpdate({ kickSlug: e.target.value })}
            placeholder="channel slug (e.g. beardds)"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25"
          />
          <p className="text-[10px] text-white/30 mt-1">
            No login needed — subs, gifted subs, and hosts are public on Kick's channel feed.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["kickSub", "kickHost"] as const).map((k) => (
              <button
                key={k}
                onClick={() => onToggle(k)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                  settings.enabled[k] ? "bg-green-500/10 text-green-300 border-green-500/25" : "bg-white/[0.02] text-white/25 border-white/[0.06]"
                }`}
              >
                {k.replace("kick", "")}
              </button>
            ))}
          </div>
        </section>

        {/* Joystick */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="joystick" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Joystick.tv</span>
            <StatusDot status={joystickStatus} />
          </div>
          <p className="text-[10px] text-white/30">
            Uses the same Joystick.tv bot connection as Multi-Chat — connect it there first. Tips show up here as alerts.
          </p>
          <button
            onClick={() => onToggle("joystickTip")}
            className={`mt-2 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
              settings.enabled.joystickTip ? "bg-teal-500/10 text-teal-300 border-teal-500/25" : "bg-white/[0.02] text-white/25 border-white/[0.06]"
            }`}
          >
            Tips
          </button>
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
      </div>
    </div>
  );
}
