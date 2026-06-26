interface Props {
  accentColor: string;
  onAccentChange: (color: string) => void;
  themeMode: "dark" | "light";
  onThemeModeChange: (mode: "dark" | "light") => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  chatDensity: "compact" | "normal" | "comfortable";
  onChatDensityChange: (density: "compact" | "normal" | "comfortable") => void;
  borderRadius: number;
  onBorderRadiusChange: (radius: number) => void;
  showTimestamps: boolean;
  onShowTimestampsChange: (show: boolean) => void;
  showBadges: boolean;
  onShowBadgesChange: (show: boolean) => void;
  animationsEnabled: boolean;
  onAnimationsEnabledChange: (enabled: boolean) => void;
  glowEffects: boolean;
  onGlowEffectsChange: (enabled: boolean) => void;
}

const presets = [
  { name: "Twitch Purple", color: "#9146ff" }, { name: "Kick Green", color: "#53fc18" },
  { name: "Joystick Orange", color: "#ff6b35" }, { name: "Electric Blue", color: "#3b82f6" },
  { name: "Rose Pink", color: "#f43f5e" }, { name: "Amber", color: "#f59e0b" },
  { name: "Cyan", color: "#06b6d4" }, { name: "Emerald", color: "#10b981" },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      className={`relative w-10 h-[22px] rounded-full transition-all border ${enabled ? "bg-[var(--accent-system)]/20 border-[var(--accent-system)]/30" : "bg-white/[0.04] border-white/[0.08]"}`}>
      <span className={`absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all ${enabled ? "left-[22px] bg-[var(--accent-system)]" : "left-[3px] bg-white/30"}`} />
    </button>
  );
}

export default function ThemeTab({
  accentColor, onAccentChange, themeMode, onThemeModeChange, fontSize, onFontSizeChange,
  chatDensity, onChatDensityChange, borderRadius, onBorderRadiusChange,
  showTimestamps, onShowTimestampsChange, showBadges, onShowBadgesChange,
  animationsEnabled, onAnimationsEnabledChange, glowEffects, onGlowEffectsChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-3">Appearance</h4>
        <div className="flex items-center justify-between mb-3">
          <div><div className="text-[11px] text-white/50">Theme Mode</div><div className="text-[9px] text-white/20 mt-0.5">Switch between dark and light</div></div>
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            {(["dark", "light"] as const).map((mode) => (
              <button key={mode} onClick={() => onThemeModeChange(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${themeMode === mode ? "bg-white/[0.08] text-white/80" : "text-white/25 hover:text-white/45"}`}>
                {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div><div className="text-[11px] text-white/50">Font Size</div><div className="text-[9px] text-white/20 mt-0.5">Adjust interface text size</div></div>
          <div className="flex items-center gap-2">
            <button onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))} className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] flex items-center justify-center hover:bg-white/[0.08] transition-all">−</button>
            <span className="text-[11px] text-white/60 font-mono w-6 text-center">{fontSize}</span>
            <button onClick={() => onFontSizeChange(Math.min(20, fontSize + 1))} className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] flex items-center justify-center hover:bg-white/[0.08] transition-all">+</button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div><div className="text-[11px] text-white/50">Chat Density</div><div className="text-[9px] text-white/20 mt-0.5">Spacing between chat messages</div></div>
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            {(["compact", "normal", "comfortable"] as const).map((d) => (
              <button key={d} onClick={() => onChatDensityChange(d)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all capitalize ${chatDensity === d ? "bg-white/[0.08] text-white/80" : "text-white/25 hover:text-white/45"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div><div className="text-[11px] text-white/50">Border Radius</div><div className="text-[9px] text-white/20 mt-0.5">Roundness of UI elements</div></div>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={24} value={borderRadius} onChange={(e) => onBorderRadiusChange(Number(e.target.value))}
              className="w-20 h-1 accent-[var(--accent-system)] bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-system)]" />
            <span className="text-[10px] text-white/40 font-mono w-5 text-right">{borderRadius}</span>
          </div>
        </div>
      </div>

      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-3">Accent Color</h4>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {presets.map((p) => (
            <button key={p.color} onClick={() => onAccentChange(p.color)}
              className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all ${accentColor === p.color ? "border-white/20 bg-white/[0.06]" : "border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03]"}`}>
              <span className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: p.color, boxShadow: `0 0 12px ${p.color}40` }} />
              <span className="text-[9px] text-white/30">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input type="color" value={accentColor} onChange={(e) => onAccentChange(e.target.value)} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
          <input type="text" value={accentColor} onChange={(e) => onAccentChange(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-[var(--accent-system)]/40" />
        </div>
      </div>

      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-3">Chat Display</h4>
        <div className="flex items-center justify-between mb-3">
          <div><div className="text-[11px] text-white/50">Show Timestamps</div><div className="text-[9px] text-white/20 mt-0.5">Display time next to messages</div></div>
          <Toggle enabled={showTimestamps} onChange={onShowTimestampsChange} />
        </div>
        <div className="flex items-center justify-between">
          <div><div className="text-[11px] text-white/50">Show Badges</div><div className="text-[9px] text-white/20 mt-0.5">Display user badges in chat</div></div>
          <Toggle enabled={showBadges} onChange={onShowBadgesChange} />
        </div>
      </div>

      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-3">Effects</h4>
        <div className="flex items-center justify-between mb-3">
          <div><div className="text-[11px] text-white/50">Animations</div><div className="text-[9px] text-white/20 mt-0.5">Enable UI transitions and animations</div></div>
          <Toggle enabled={animationsEnabled} onChange={onAnimationsEnabledChange} />
        </div>
        <div className="flex items-center justify-between">
          <div><div className="text-[11px] text-white/50">Glow Effects</div><div className="text-[9px] text-white/20 mt-0.5">Accent glow on buttons and indicators</div></div>
          <Toggle enabled={glowEffects} onChange={onGlowEffectsChange} />
        </div>
      </div>

      <div className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
        <h4 className="text-[12px] font-semibold text-white/70 mb-3">Preview</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="text-[11px] text-white/50">Active indicator</span>
          </div>
          <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all"
            style={{ backgroundColor: accentColor, boxShadow: glowEffects ? `0 4px 12px ${accentColor}30` : "none", borderRadius: `${borderRadius}px` }}>
            Primary Button
          </button>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full w-2/3 rounded-full transition-all" style={{ backgroundColor: accentColor, boxShadow: glowEffects ? `0 0 8px ${accentColor}50` : "none" }} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[9px] text-white/20 font-mono">12:34</span>
            <span className="text-[10px] text-white/40">PreviewUser</span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-white/[0.04] text-white/25">BADGE</span>
            <span className="text-[11px] text-white/30">Sample message text</span>
          </div>
        </div>
      </div>
    </div>
  );
}
