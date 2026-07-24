import { useState } from "react";
import { useSceneSwitcherConnection } from "./useSceneSwitcherConnection";
import { useSceneSwitcherSettings } from "./useSceneSwitcherSettings";
import { SettingsPanel } from "./SettingsPanel";
import "../../design-system/styles.css";
import { Button, Card, SectionHead } from "../../design-system/components/core";

const SCENE_COLORS = [
  "border-amber-500/25 bg-amber-500/10",
  "border-green-500/25 bg-green-500/10",
  "border-blue-500/25 bg-blue-500/10",
  "border-purple-500/25 bg-purple-500/10",
  "border-red-500/25 bg-red-500/10",
  "border-cyan-500/25 bg-cyan-500/10",
];

export default function SceneSwitcherApp() {
  const { settings, update } = useSceneSwitcherSettings();
  const [showSettings, setShowSettings] = useState(false);
  const { status, error, scenes, tracks, isStreaming, isRecording, connect, showScene, toggleMute, toggleStream, toggleRecord } =
    useSceneSwitcherConnection(settings.platform, { host: settings.obsHost, port: settings.obsPort, password: settings.obsPassword });
  const connected = status === "connected";
  const platformName = settings.platform === "obs" ? "OBS" : "Meld";

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <SectionHead
            icon="🔀"
            title="Scene Switcher"
            desc="Control OBS Studio or Meld Studio scenes remotely"
            right={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                  ⚙️
                </Button>
                <Button variant={connected ? "success" : "ghost"} disabled={status === "connecting"} onClick={connect}>
                  {connected ? `🟢 Connected to ${platformName}` : status === "connecting" ? "Connecting…" : `⚪ Connect to ${platformName}`}
                </Button>
              </div>
            }
          />
        </div>

        {/* Connection info */}
        {!connected && (
          <Card padding={16} className="mb-6">
            {settings.platform === "obs" ? (
              <p className="text-[11px] text-amber-400/70 leading-relaxed">
                ⚠️ OBS Studio needs to be running with its WebSocket server enabled (Tools → WebSocket Server Settings) on{" "}
                <code>
                  ws://{settings.obsHost}:{settings.obsPort}
                </code>
                . {error && <span className="block mt-1 text-red-400/70">{error}</span>}
              </p>
            ) : (
              <p className="text-[11px] text-amber-400/70 leading-relaxed">
                ⚠️ Meld Studio needs to be running with its API server enabled (Settings → Integrations → API) on{" "}
                <code>ws://127.0.0.1:13376</code>.{error && <span className="block mt-1 text-red-400/70">{error}</span>}
              </p>
            )}
          </Card>
        )}

        {/* Scene grid */}
        {connected && scenes.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">No scenes found in the current {platformName} session.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(connected ? scenes : []).map((scene, i) => (
              <button
                key={scene.id}
                onClick={() => showScene(scene.id)}
                className={`relative p-5 rounded-2xl border text-left transition-all ${
                  scene.current ? `${SCENE_COLORS[i % SCENE_COLORS.length]} border-2 shadow-lg` : "bd-card hover:-translate-y-0.5"
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
          <Card padding={16} className="mt-6">
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
          </Card>
        )}

        {/* Stream / record controls */}
        {connected && (
          <Card padding={16} className="mt-6">
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
          </Card>
        )}
      </div>

      {showSettings && <SettingsPanel settings={settings} onUpdate={update} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
