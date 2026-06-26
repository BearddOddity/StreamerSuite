import { useState } from "react";
import { useSharedSettings } from "@/settings";
import type { RoutingMode } from "@/settings";
import { GlassSelect } from "./SettingsComponents";

const routingModeOptions = [
  { value: "streamer_bot", label: "Streamer.bot" },
  { value: "native", label: "Native (Direct API)" },
];

export default function RoutingTab() {
  const { routing, updateRouting, setRouting } = useSharedSettings();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRouting({
      ...routing,
      routingMode: "streamer_bot",
      sbPort: 8080,
      sbActionName: "UpdateCategory",
      preferredTwitchMode: "ws",
      preferredKickMode: "api",
      preferredJoystickMode: "ws",
    });
  };

  return (
    <div className="space-y-3">
      {/* ── Mode ───────────────────────────────────────────────────────────── */}
      <div className="surface-card rounded-2xl p-5">
        <h3 className="text-white font-semibold text-[13px] mb-4">Mode</h3>

        <div className="mb-4">
          <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Routing Mode</label>
          <GlassSelect value={routing.routingMode} options={routingModeOptions} onChange={(v) => updateRouting("routingMode", v as RoutingMode)} className="w-full" />
        </div>

        {routing.routingMode === "streamer_bot" && (
          <>
            <div className="mb-4">
              <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Streamer.bot Port</label>
              <input
                type="number"
                value={routing.sbPort ?? 8080}
                onChange={(e) => updateRouting("sbPort", parseInt(e.target.value) || 8080)}
                className="input-glass w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Action Name</label>
              <input
                value={routing.sbActionName ?? ""}
                onChange={(e) => updateRouting("sbActionName", e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </>
        )}
      </div>

      {/* ── Twitch ─────────────────────────────────────────────────────────── */}
      <div className="surface-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm">🟣</span>
          <h3 className="text-white font-semibold text-[13px]">Twitch</h3>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Connection Mode</label>
          <div className="flex gap-2">
            {(["api", "ws"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateRouting("preferredTwitchMode", mode)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-medium border transition-all ${
                  routing.preferredTwitchMode === mode
                    ? "border-[#9146ff]/40 text-[#9146ff] bg-[#9146ff]/10"
                    : "border-white/[0.06] text-white/25 hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}
              >
                <span className="block font-semibold">{mode === "api" ? "API Mode" : "WebSocket"}</span>
                <span className="block text-[9px] mt-0.5 opacity-50">
                  {mode === "api" ? "REST API calls" : "IRC WebSocket"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => window?.open?.("http://127.0.0.1:53735/twitch/login", "_blank")}
          className="btn-ghost"
        >
          🔗 Connect Twitch
        </button>
      </div>

      {/* ── Kick ───────────────────────────────────────────────────────────── */}
      <div className="surface-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm">🟢</span>
          <h3 className="text-white font-semibold text-[13px]">Kick</h3>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Connection Mode</label>
          <div className="flex gap-2">
            {(["api", "ws"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateRouting("preferredKickMode", mode)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-medium border transition-all ${
                  routing.preferredKickMode === mode
                    ? "border-[#53fc18]/40 text-[#53fc18] bg-[#53fc18]/10"
                    : "border-white/[0.06] text-white/25 hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}
              >
                <span className="block font-semibold">{mode === "api" ? "API Mode" : "WebSocket"}</span>
                <span className="block text-[9px] mt-0.5 opacity-50">
                  {mode === "api" ? "REST API calls" : "Pusher WebSocket"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => window?.open?.("http://127.0.0.1:53735/kick/login", "_blank")}
          className="btn-ghost"
        >
          🔗 Connect Kick
        </button>
      </div>

      {/* ── JoystickTV ─────────────────────────────────────────────────────── */}
      <div className="surface-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm">🟠</span>
          <h3 className="text-white font-semibold text-[13px]">JoystickTV</h3>
        </div>

        <div className="mb-2">
          <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Connection Mode</label>
          <div className="flex gap-2">
            {(["api", "ws"] as const).map((mode) => {
              const forced = mode === "ws";
              return (
                <button
                  key={mode}
                  onClick={() => !forced && updateRouting("preferredJoystickMode", mode)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-medium border transition-all ${
                    routing.preferredJoystickMode === mode
                      ? "border-[#ff6b35]/40 text-[#ff6b35] bg-[#ff6b35]/10"
                      : forced
                        ? "border-white/[0.04] text-white/15 cursor-default"
                        : "border-white/[0.06] text-white/25 hover:border-white/[0.1] hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="block font-semibold">{mode === "api" ? "API Mode" : "WebSocket"}</span>
                  <span className="block text-[9px] mt-0.5 opacity-50">
                    {forced ? "Only option available" : mode === "api" ? "REST API calls" : "Direct WebSocket"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-white/15 mt-2 italic">ℹ️ JoystickTV has no public API — WebSocket only.</p>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button onClick={handleSave} className="btn-ghost">
          {saved ? "✓ Saved" : "Save Routing"}
        </button>
        <button onClick={handleReset} className="btn-ghost">
          Reset
        </button>
      </div>
    </div>
  );
}
