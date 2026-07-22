import { useMeldConnection } from "./useMeldConnection";

const SCENE_COLORS = [
  "border-amber-500/25 bg-amber-500/10",
  "border-green-500/25 bg-green-500/10",
  "border-blue-500/25 bg-blue-500/10",
  "border-purple-500/25 bg-purple-500/10",
  "border-red-500/25 bg-red-500/10",
  "border-cyan-500/25 bg-cyan-500/10",
];

export default function SceneSwitcherApp() {
  const { status, error, scenes, tracks, isStreaming, isRecording, connect, showScene, toggleMute, toggleStream, toggleRecord } =
    useMeldConnection();
  const connected = status === "connected";

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Scene Switcher</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Control Meld Studio scenes remotely</p>
          </div>
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              connected ? "bg-green-500/10 text-green-400 border-green-500/25" : "btn-ghost"
            }`}
          >
            {connected ? "🟢 Connected" : status === "connecting" ? "Connecting…" : "⚪ Connect to Meld"}
          </button>
        </div>

        {/* Connection info */}
        {!connected && (
          <div className="surface-glass p-4 mb-6">
            <p className="text-[11px] text-amber-400/70 leading-relaxed">
              ⚠️ Meld Studio needs to be running with its API server enabled (Settings → Integrations → API) on{" "}
              <code>ws://127.0.0.1:13376</code>.{error && <span className="block mt-1 text-red-400/70">{error}</span>}
            </p>
          </div>
        )}

        {/* Scene grid */}
        {connected && scenes.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">No scenes found in the current Meld session.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(connected ? scenes : []).map((scene, i) => (
              <button
                key={scene.id}
                onClick={() => showScene(scene.id)}
                className={`relative p-5 rounded-2xl border text-left transition-all ${
                  scene.current ? `${SCENE_COLORS[i % SCENE_COLORS.length]} border-2 shadow-lg` : "card-glass hover:-translate-y-0.5"
                }`}
              >
                {scene.current && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 status-dot-pulse" />}
                <span className="text-[13px] font-semibold text-white/80 block">{scene.name}</span>
                <span className="text-[10px] text-white/25 mt-1 block">
                  {scene.current ? "Active" : scene.staged ? "Staged" : "Click to switch"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Audio tracks */}
        {connected && tracks.length > 0 && (
          <div className="mt-6 surface-glass p-4">
            <h4 className="text-[12px] font-semibold text-white/70 mb-3">Audio</h4>
            <div className="flex flex-wrap gap-2">
              {tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => toggleMute(track.id)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all ${
                    track.muted ? "border-red-500/25 bg-red-500/10 text-red-300" : "btn-ghost"
                  }`}
                >
                  {track.muted ? "🔇" : "🔊"} {track.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stream / record controls */}
        {connected && (
          <div className="mt-6 surface-glass p-4">
            <h4 className="text-[12px] font-semibold text-white/70 mb-3">Broadcast</h4>
            <div className="flex gap-2">
              <button
                onClick={toggleStream}
                className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                  isStreaming ? "border-red-500/25 bg-red-500/10 text-red-300" : "border-green-500/25 bg-green-500/10 text-green-300"
                }`}
              >
                {isStreaming ? "⏹ Stop Stream" : "▶ Start Stream"}
              </button>
              <button
                onClick={toggleRecord}
                className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                  isRecording ? "border-red-500/25 bg-red-500/10 text-red-300" : "btn-ghost"
                }`}
              >
                {isRecording ? "⏹ Stop Recording" : "⏺ Start Recording"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
