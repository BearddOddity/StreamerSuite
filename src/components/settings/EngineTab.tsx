import type { EngineSettings, DetectionConfig, DetectionMode } from "@/settings";
import {
  Toggle,
  CollapsibleSection,
} from "./SettingsComponents";

interface Props {
  engine: EngineSettings;
  detection: DetectionConfig;
  devUnlocked?: boolean;
  onEngineChange: <K extends keyof EngineSettings>(key: K, value: EngineSettings[K]) => void;
  onDetectionChange: <K extends keyof DetectionConfig>(key: K, value: DetectionConfig[K]) => void;
}

export default function EngineTab({ engine, detection, devUnlocked = false, onEngineChange: e, onDetectionChange: d }: Props) {
  const etoggle = (key: keyof EngineSettings) => e(key, !engine[key] as any);
  const dtoggle = (key: keyof DetectionConfig) => d(key, !detection[key] as any);

  const nativeLocked = !devUnlocked || !detection.closedBetaChannel;

  return (
    <div className="space-y-4">
      {/* Detection Mode & Pipeline */}
      <CollapsibleSection
        title="Detection Mode & Pipeline"
        icon="🔄"
        badge={
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 border ${
            detection.mode === "native" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : detection.mode === "spark" ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
            : "bg-purple-500/10 border-purple-500/20 text-purple-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              detection.mode === "native" ? "bg-emerald-400" : detection.mode === "spark" ? "bg-blue-400" : "bg-purple-400"
            }`} />
            {detection.mode === "native" ? "NATIVE" : detection.mode === "spark" ? "SPARK" : "PYTHON"}
          </span>
        }
      >
        <div className="flex flex-col gap-2">
          {/* Python */}
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            detection.mode === "python" ? "bg-purple-500/8 border-purple-500/25" : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
          }`}>
            <input type="radio" name="detection_mode" checked={detection.mode === "python"}
              onChange={() => d("mode", "python" as DetectionMode)} className="accent-purple-500" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 font-medium">Python</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-semibold">LEGACY</span>
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">Flask sidecar on port 53735. Battle-tested, full feature parity.</p>
            </div>
          </label>

          {/* Native */}
          <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
            nativeLocked ? "bg-white/[0.01] border-white/[0.03] opacity-50 cursor-not-allowed"
            : detection.mode === "native" ? "bg-emerald-500/8 border-emerald-500/25 cursor-pointer"
            : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04] cursor-pointer"
          }`}>
            <input type="radio" name="detection_mode" checked={detection.mode === "native"}
              disabled={nativeLocked} onChange={() => { if (!nativeLocked) d("mode", "native" as DetectionMode); }}
              className="accent-emerald-500" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${nativeLocked ? "text-white/30" : "text-white/80"}`}>Native (Experimental)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-semibold">EXPERIMENTAL</span>
                {nativeLocked && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-white/40 font-semibold">LOCKED</span>
                )}
              </div>
              <p className={`text-[10px] mt-0.5 ${nativeLocked ? "text-white/20" : "text-white/30"}`}>
                {nativeLocked ? "Enable Dev Tools and Closed Beta Channel to unlock." : "Pure Rust engine loop. No Python dependency. Faster, smaller, Windows + Linux only."}
              </p>
            </div>
          </label>

          {/* Spark */}
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            detection.mode === "spark" ? "bg-blue-500/8 border-blue-500/25" : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
          }`}>
            <input type="radio" name="detection_mode" checked={detection.mode === "spark"}
              onChange={() => d("mode", "spark" as DetectionMode)} className="accent-blue-500" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80 font-medium">Spark (Dual-PC)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">REMOTE</span>
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">Stream gameplay metadata from a second PC via UDP. Requires Spark host agent on remote machine.</p>
            </div>
          </label>
        </div>

        {/* Auto-fallback */}
        {detection.mode === "native" && (
          <div className="mt-4 p-3 bg-yellow-500/[0.04] border border-yellow-500/15 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-yellow-300/80 font-medium">Auto-fallback to Python</span>
                <p className="text-[10px] text-white/30 mt-0.5">If the native engine fails to start, automatically fall back to the Python sidecar.</p>
              </div>
              <Toggle on={detection.pythonFallback} onToggle={() => dtoggle("pythonFallback")} />
            </div>
          </div>
        )}

        {/* Spark PIN */}
        {detection.mode === "spark" && (
          <div className="mt-4 p-3 bg-blue-500/[0.04] border border-blue-500/15 rounded-xl">
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Spark Receiver PIN</label>
            <input type="text" maxLength={4} value={engine.sparkPin}
              onChange={(v) => e("sparkPin", v.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000" className="input-glass !w-24 tracking-[0.5em] text-center placeholder:tracking-normal font-mono" />
            <p className="text-[10px] text-white/25 mt-1.5">Secure 4-digit PIN — must match the passcode on your Spark host.</p>
          </div>
        )}

        {/* Dev Tools */}
        <div className="mt-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-white/70 font-medium">Dev Tools Mode</span>
              <p className="text-[10px] text-white/30 mt-0.5">Enable experimental features and advanced configuration options.</p>
            </div>
            <Toggle on={detection.devToolsEnabled} onToggle={() => dtoggle("devToolsEnabled")} />
          </div>
        </div>
        <div className="mt-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-white/70 font-medium">Closed Beta Channel</span>
              <p className="text-[10px] text-white/30 mt-0.5">Receive pre-release builds with experimental features.</p>
            </div>
            <Toggle on={detection.closedBetaChannel} onToggle={() => dtoggle("closedBetaChannel")} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Detection Pipeline */}
      <CollapsibleSection
        title="Detection Pipeline"

        icon="⛓️"
      >
        <p className="text-xs text-white/40 mb-4 leading-relaxed">
          The multi-stage ForgeWaterfall evaluates running processes to decide whether they should be accepted, rejected, or forwarded for further analysis.
        </p>

        {/* Pipeline flow indicator */}
        <div className="flex items-center gap-1.5 mb-5 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          {["1", "2", "3", "4", "5", "6"].map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                s === "2" ? (engine.strictForgeMode ? "bg-green-400 shadow-sm shadow-green-400/50" : "bg-white/15")
                : s === "3" ? (engine.processFilterBypass ? "bg-yellow-400/60 shadow-sm shadow-yellow-400/50" : "bg-green-400")
                : "bg-green-400"
              }`} />
              {i < 5 && <span className="text-white/[0.08] text-[10px]">→</span>}
            </span>
          ))}
          <span className="text-[11px] font-medium text-white/50 ml-2">
            Waterfall Mode: <span className="text-purple-300">{engine.strictForgeMode ? "Strict Lockdown" : "Standard Evaluator"}</span>
          </span>
        </div>

        {/* Stage 2: Lockdown */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-3.5">
            <span className="w-6 h-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <span className="text-xs text-white/80 font-medium">Lockdown</span>
              <p className="text-[10px] text-white/30 mt-0.5">Instantly rejects any process not explicitly in your library</p>
            </div>
          </div>
          <Toggle on={engine.strictForgeMode} onToggle={() => etoggle("strictForgeMode")} />
        </div>

        {/* Stage 3: Behavior Traps */}
        <div className="border-b border-white/[0.05]">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3.5">
              <span className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
              <div>
                <span className="text-xs text-white/80 font-medium">Behavior Traps</span>
                <p className="text-[10px] text-white/30 mt-0.5">Instantly discards non-game software using smart geometric & system traps</p>
              </div>
            </div>
            <button onClick={() => etoggle("processFilterBypass")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer border ${
                engine.processFilterBypass ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-white/[0.05] text-white/40 border-white/10 hover:bg-white/[0.08]"
              }`}>
              {engine.processFilterBypass ? "Bypassed" : "Active"}
            </button>
          </div>
          <div className="ml-9 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-white/70 font-medium">Emulator Detection</span>
                <p className="text-[10px] text-white/35 mt-0.5">Detect games inside popular emulators (Yuzu, RPCS3, Citra, etc.)</p>
              </div>
              <Toggle on={engine.emulatorDetection} onToggle={() => etoggle("emulatorDetection")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-white/70 font-medium">Chromium Trap</span>
                <p className="text-[10px] text-white/35 mt-0.5">Reject Chromium-based processes</p>
              </div>
              <Toggle on={engine.trapChromium} onToggle={() => etoggle("trapChromium")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-white/70 font-medium">Cmdline Trap</span>
                <p className="text-[10px] text-white/35 mt-0.5">Analyze command-line arguments for game indicators</p>
              </div>
              <Toggle on={engine.trapCmdline} onToggle={() => etoggle("trapCmdline")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-white/70 font-medium">UI Framework Trap</span>
                <p className="text-[10px] text-white/35 mt-0.5">Detect UI framework processes (Electron, Qt, etc.)</p>
              </div>
              <Toggle on={engine.trapUiFramework} onToggle={() => etoggle("trapUiFramework")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-white/70 font-medium">Geometry Trap</span>
                <p className="text-[10px] text-white/35 mt-0.5">Analyze window geometry for game-like characteristics</p>
              </div>
              <Toggle on={engine.trapGeometry} onToggle={() => etoggle("trapGeometry")} />
            </div>
          </div>
        </div>

        {/* Stage 5: Confidence Scoring */}
        <div className="border-b border-white/[0.05]">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3.5">
              <span className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center shrink-0">5</span>
              <div>
                <span className="text-xs text-white/80 font-medium">Confidence Scoring</span>
                <p className="text-[10px] text-white/30 mt-0.5">Weighted scoring to classify processes as games</p>
              </div>
            </div>
          </div>
          <div className="ml-9 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-white/35 w-7 text-right">+0.4</span>
                <div>
                  <span className="text-xs text-white/70 font-medium">Engine DNA</span>
                  <p className="text-[10px] text-white/35 mt-0.5">Process binary signature analysis</p>
                </div>
              </div>
              <Toggle on={engine.scoreEngineDna} onToggle={() => etoggle("scoreEngineDna")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-white/35 w-7 text-right">+0.3</span>
                <div>
                  <span className="text-xs text-white/70 font-medium">Fullscreen Mode</span>
                  <p className="text-[10px] text-white/35 mt-0.5">Process is running in fullscreen</p>
                </div>
              </div>
              <Toggle on={engine.scoreFullscreen} onToggle={() => etoggle("scoreFullscreen")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-white/35 w-7 text-right">+0.2</span>
                <div>
                  <span className="text-xs text-white/70 font-medium">Unique Window Title</span>
                  <p className="text-[10px] text-white/35 mt-0.5">Window title contains localized display name</p>
                </div>
              </div>
              <Toggle on={engine.scoreWindowTitle} onToggle={() => etoggle("scoreWindowTitle")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-white/35 w-7 text-right">+0.1</span>
                <div>
                  <span className="text-xs text-white/70 font-medium">Heavy RAM Allocation</span>
                  <p className="text-[10px] text-white/35 mt-0.5">Memory exceeds the base RAM floor criteria</p>
                </div>
              </div>
              <Toggle on={engine.scoreRam} onToggle={() => etoggle("scoreRam")} />
            </div>
            {/* Score Threshold */}
            <div className="pt-3 border-t border-white/[0.03]">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-xs text-white/70 font-medium">Score Threshold</span>
                  <p className="text-[10px] text-white/35 mt-0.5">Required aggregate weight to classify process as an active game</p>
                </div>
                <span className="text-xs font-mono font-semibold text-purple-300">{engine.confidenceThreshold.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={100} step={5}
                value={Math.round(engine.confidenceThreshold * 100)}
                onChange={(v) => e("confidenceThreshold", parseInt(v.target.value) / 100)}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
              <div className="flex justify-between text-[9px] text-white/20 mt-0.5 font-mono">
                <span>0.0 — absolute trust</span>
                <span>{(
                  (engine.scoreEngineDna ? 0.4 : 0) + (engine.scoreFullscreen ? 0.3 : 0) +
                  (engine.scoreWindowTitle ? 0.2 : 0) + (engine.scoreRam ? 0.1 : 0)
                ).toFixed(1)} — maximum strict</span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Timing & Rates */}
      <CollapsibleSection
        title="Timing & Rates"

        icon="⏳"
        badge={<span className="text-[10px] bg-white/5 border border-white/5 text-white/50 px-2 py-0.5 rounded font-mono font-medium">Scan: {engine.scanInterval}s</span>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Scan Interval (s)</label>
            <input type="number" min={1} max={60} value={engine.scanInterval}
              onChange={(v) => e("scanInterval", parseInt(v.target.value) || 1)} className="input-glass font-mono" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Grace Period (s)</label>
            <input type="number" min={0} max={120} value={engine.gracePeriod}
              onChange={(v) => e("gracePeriod", parseInt(v.target.value) || 0)} className="input-glass font-mono" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Widget Poll Rate (s)</label>
            <input type="number" min={1} max={60} value={engine.widgetPollRate}
              onChange={(v) => e("widgetPollRate", parseInt(v.target.value) || 1)} className="input-glass font-mono" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Widget Fade Timer (s)</label>
            <input type="number" min={0} max={600} value={engine.widgetFadeTimer}
              onChange={(v) => e("widgetFadeTimer", parseInt(v.target.value) || 0)} className="input-glass font-mono" />
          </div>
        </div>
      </CollapsibleSection>

      {/* Idle State */}
      <CollapsibleSection
        title="Idle State Fallback"

        icon="🌙"
        badge={<span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full font-semibold max-w-[120px] truncate">{engine.idleCategory || "None"}</span>}
      >
        <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Default Idle Category</label>
        <input type="text" value={engine.idleCategory} onChange={(v) => e("idleCategory", v.target.value)}
          placeholder="e.g. Just Chatting" className="input-glass" />
        <p className="text-[10px] text-white/20 mt-1.5">Category published to streaming APIs when no valid game is detected.</p>
      </CollapsibleSection>

      {/* RAM Threshold */}
      <CollapsibleSection
        title="RAM Threshold"

        icon="🧠"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/70 font-medium">RAM Floor (MB)</span>
          <span className="text-xs font-mono font-semibold text-purple-300">{engine.ramThreshold} MB</span>
        </div>
        <input type="range" min={10} max={500} step={10} value={engine.ramThreshold}
          onChange={(v) => e("ramThreshold", parseInt(v.target.value))}
          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
        <div className="flex justify-between text-[9px] text-white/20 mt-0.5 font-mono">
          <span>10 MB</span>
          <span>500 MB</span>
        </div>
      </CollapsibleSection>

      {/* Widget Token */}
      <CollapsibleSection
        title="Widget Token"

        icon="🔑"
      >
        <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <p className="text-white/60 text-xs flex-1">
            Widget Token:{" "}
            <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono text-white/90">
              {engine.widgetToken || "Not set"}
            </code>
          </p>
          <button onClick={() => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            const token = Array.from({ length: 22 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
            e("widgetToken", token);
          }} className="text-[10px] px-2.5 py-1.5 rounded bg-white/[0.04] border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-all cursor-pointer">
            ↻ Regenerate
          </button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
