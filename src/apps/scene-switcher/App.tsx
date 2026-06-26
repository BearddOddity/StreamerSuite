import { useState } from "react";

interface Scene {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const defaultScenes: Scene[] = [
  { id: "starting", name: "Starting Soon", icon: "🎬", color: "border-amber-500/25 bg-amber-500/10" },
  { id: "live", name: "Live Gameplay", icon: "🎮", color: "border-green-500/25 bg-green-500/10" },
  { id: "brb", name: "BRB Screen", icon: "☕", color: "border-blue-500/25 bg-blue-500/10" },
  { id: "chatting", name: "Just Chatting", icon: "💬", color: "border-purple-500/25 bg-purple-500/10" },
  { id: "ending", name: "Stream Ending", icon: "🌙", color: "border-red-500/25 bg-red-500/10" },
  { id: "cam-only", name: "Cam Only", icon: "📷", color: "border-cyan-500/25 bg-cyan-500/10" },
];

export default function SceneSwitcherApp() {
  const [scenes] = useState<Scene[]>(defaultScenes);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Scene Switcher</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Manage your OBS scenes</p>
          </div>
          <button onClick={() => setConnected(!connected)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              connected
                ? "bg-green-500/10 text-green-400 border-green-500/25"
                : "btn-ghost"
            }`}>
            {connected ? "🟢 Connected" : "⚪ Connect OBS"}
          </button>
        </div>

        {/* Connection info */}
        {!connected && (
          <div className="surface-glass p-4 mb-6">
            <p className="text-[11px] text-amber-400/70 leading-relaxed">
              ⚠️ Connect to OBS via WebSocket to control scenes remotely. Requires OBS WebSocket plugin (port 4455).
            </p>
          </div>
        )}

        {/* Scene grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {scenes.map((scene) => (
            <button key={scene.id} onClick={() => connected && setActiveScene(scene.id)}
              className={`relative p-5 rounded-2xl border text-left transition-all ${
                activeScene === scene.id
                  ? `${scene.color} border-2 shadow-lg`
                  : "card-glass"
              } ${!connected ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5"}`}>
              {activeScene === scene.id && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 status-dot-pulse" />
              )}
              <span className="text-2xl block mb-2">{scene.icon}</span>
              <span className="text-[13px] font-semibold text-white/80 block">{scene.name}</span>
              <span className="text-[10px] text-white/25 mt-1 block">
                {activeScene === scene.id ? "Active" : connected ? "Click to switch" : "Connect OBS first"}
              </span>
            </button>
          ))}
        </div>

        {/* Transition controls */}
        {connected && (
          <div className="mt-6 surface-glass p-4">
            <h4 className="text-[12px] font-semibold text-white/70 mb-3">Transitions</h4>
            <div className="flex gap-2">
              {["Cut", "Fade", "Swipe", "Stinger"].map((t) => (
                <button key={t}
                  className="flex-1 py-2 rounded-xl text-[11px] font-medium btn-ghost">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
