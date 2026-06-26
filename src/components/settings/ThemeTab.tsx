import type { ThemeConfig, Density, RadiusPreset, TransitionSpeed, ChatDensity } from "@/settings";
import {
  Toggle,
  SettingsRow,
  CollapsibleSection,
  GlassSelect,
} from "./SettingsComponents";

interface Props extends ThemeConfig {
  onFieldChange: <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => void;
}

const accentPresets = [
  { name: "Twitch Purple", color: "#9146ff" },
  { name: "Kick Green", color: "#53fc18" },
  { name: "Joystick Orange", color: "#ff6b35" },
  { name: "Electric Blue", color: "#3b82f6" },
  { name: "Rose Pink", color: "#f43f5e" },
  { name: "Amber", color: "#f59e0b" },
  { name: "Cyan", color: "#06b6d4" },
  { name: "Emerald", color: "#10b981" },
];

const bgPresets = [
  { name: "Forge Black", color: "#050505" },
  { name: "Charcoal", color: "#0c0c0e" },
  { name: "Obsidian", color: "#0a0a12" },
  { name: "Midnight", color: "#02040a" },
  { name: "Warm Dark", color: "#0a0806" },
  { name: "Slate", color: "#0d1117" },
];

const fontWeightOptions = [
  { value: "300", label: "Light (300)", weight: 300 },
  { value: "400", label: "Regular (400)", weight: 400 },
  { value: "500", label: "Medium (500)", weight: 500 },
  { value: "600", label: "Semibold (600)", weight: 600 },
  { value: "700", label: "Bold (700)", weight: 700 },
  { value: "800", label: "Extra Bold (800)", weight: 800 },
  { value: "900", label: "Black (900)", weight: 900 },
];

const borderRadiusOptions = [
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
  { value: "rounded", label: "Rounded" },
];

const densityOptions = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "spacious", label: "Spacious" },
];

const transitionSpeedOptions = [
  { value: "instant", label: "Instant" },
  { value: "fast", label: "Fast" },
  { value: "normal", label: "Normal" },
  { value: "slow", label: "Slow" },
];

export default function ThemeTab(props: Props) {
  const { onFieldChange: u } = props;
  const toggle = (key: keyof ThemeConfig) => u(key, !props[key] as any);

  return (
    <div className="space-y-4">
      {/* Appearance */}
      <CollapsibleSection title="Appearance" icon="🎨" defaultOpen>
        <SettingsRow label="Theme Mode" description="Switch between dark and light">
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            {(["dark", "light"] as const).map((mode) => (
              <button key={mode} onClick={() => u("themeMode", mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border-none ${
                  props.themeMode === mode ? "bg-white/[0.08] text-white/80" : "text-white/25 hover:text-white/45 bg-transparent"
                }`}>
                {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Font Size" description="Base text size for the interface (excludes chat)">
          <div className="flex items-center gap-2">
            <button onClick={() => u("fontSize", Math.max(10, props.fontSize - 1))}
              className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] flex items-center justify-center hover:bg-white/[0.08] transition-all cursor-pointer">−</button>
            <span className="text-[11px] text-white/60 font-mono w-6 text-center">{props.fontSize}</span>
            <button onClick={() => u("fontSize", Math.min(20, props.fontSize + 1))}
              className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] flex items-center justify-center hover:bg-white/[0.08] transition-all cursor-pointer">+</button>
          </div>
        </SettingsRow>
        <SettingsRow label="Font Family" description="Font family for the interface — any Google Font or system font (excludes chat)">
          <input type="text" value={props.fontFamily} onChange={(e) => u("fontFamily", e.target.value)}
            placeholder="e.g. 'Inter', system-ui, 'Roboto Mono'" className="input-glass !w-[140px]" />
        </SettingsRow>
        <SettingsRow label="Font Weight" description="Font weight for the interface (excludes chat)">
          <GlassSelect value={props.fontWeight} options={fontWeightOptions} onChange={(v) => u("fontWeight", v)} />
        </SettingsRow>
        <SettingsRow label="Border Radius" description="Roundness of UI elements">
          <GlassSelect value={props.borderRadius} options={borderRadiusOptions} onChange={(v) => u("borderRadius", v as RadiusPreset)} />
        </SettingsRow>

        {/* Accent Color */}
        <div className="pt-3 mt-3 border-t border-white/[0.04]">
          <div className="text-[12px] text-white/60 font-medium mb-2.5">Accent Color</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {accentPresets.map((p) => (
              <button key={p.color} onClick={() => u("accentColor", p.color)}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all cursor-pointer ${
                  props.accentColor === p.color ? "border-white/20 bg-white/[0.06]" : "border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}>
                <span className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: p.color, boxShadow: `0 0 12px ${p.color}40` }} />
                <span className="text-[9px] text-white/30">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input type="color" value={props.accentColor} onChange={(e) => u("accentColor", e.target.value)} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
            <input type="text" value={props.accentColor} onChange={(e) => u("accentColor", e.target.value)} className="input-glass flex-1" />
          </div>
        </div>

        {/* Base Background Color */}
        <div className="pt-3 mt-3 border-t border-white/[0.04]">
          <div className="text-[12px] text-white/60 font-medium mb-2.5">Base Background Color</div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {bgPresets.map((p) => (
              <button key={p.color} onClick={() => u("bgColor", p.color)}
                className={`flex flex-col items-center gap-1.5 py-2 px-2 rounded-xl border transition-all cursor-pointer ${
                  props.bgColor === p.color ? "border-white/20 bg-white/[0.06]" : "border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}>
                <span className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: p.color }} />
                <span className="text-[9px] text-white/30">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input type="color" value={props.bgColor} onChange={(e) => u("bgColor", e.target.value)} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
            <input type="text" value={props.bgColor} onChange={(e) => u("bgColor", e.target.value)} className="input-glass flex-1" />
          </div>
        </div>
      </CollapsibleSection>

      {/* Background Wallpaper */}
      <CollapsibleSection title="Background Wallpaper" icon="🖼️">
        <SettingsRow label="Backdrop Opacity" description="Image visibility overlay transparency">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} step={5} value={props.bgOpacity} onChange={(e) => u("bgOpacity", parseInt(e.target.value))} className="w-20" />
            <span className="text-[10px] text-white/40 font-mono w-8 text-right">{props.bgOpacity}%</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Backdrop Blur" description="Gaussian blur applied to background">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={40} step={1} value={props.bgBlur} onChange={(e) => u("bgBlur", parseInt(e.target.value))} className="w-20" />
            <span className="text-[10px] text-white/40 font-mono w-8 text-right">{props.bgBlur}px</span>
          </div>
        </SettingsRow>
        <div className="mt-3">
          <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-white/25 hover:bg-white/[0.02] transition-all">
            <span className="text-xs text-white/40 font-medium">Click to upload wallpaper</span>
            <span className="text-[10px] text-white/20 mt-0.5">PNG, JPG, WEBP or paste URL below</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => u("bgImage", ev.target?.result as string);
                reader.readAsDataURL(file);
              }} />
          </label>
          <input type="url" value={props.bgImage.startsWith("data:") ? "" : props.bgImage}
            onChange={(e) => u("bgImage", e.target.value)} placeholder="Or paste an image URL…"
            className="input-glass font-mono mt-2" />
          {props.bgImage && (
            <button onClick={() => u("bgImage", "")}
              className="mt-2 text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer">
              Remove wallpaper
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* Panels & Geometry */}
      <CollapsibleSection title="Panels & Geometry" icon="📐">
        <SettingsRow label="Panel Opacity" description="Backdrop opacity scale for main panel cards">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} step={5} value={props.panelOpacity} onChange={(e) => u("panelOpacity", parseInt(e.target.value))} className="w-20" />
            <span className="text-[10px] text-white/40 font-mono w-8 text-right">{props.panelOpacity}%</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Global Font Scale" description="Scale size metrics of core texts">
          <div className="flex items-center gap-2">
            <input type="range" min={75} max={125} step={5} value={props.fontScale} onChange={(e) => u("fontScale", parseInt(e.target.value))} className="w-20" />
            <span className="text-[10px] text-white/40 font-mono w-8 text-right">{props.fontScale}%</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Spacing Density" description="Set overall element padding and row gap sizes">
          <GlassSelect value={props.density} options={densityOptions} onChange={(v) => u("density", v as Density)} />
        </SettingsRow>
        <SettingsRow label="Sidebar Icons Only" description="Condense sidebar navigation, hiding text labels">
          <Toggle on={props.sidebarIconOnly} onToggle={() => toggle("sidebarIconOnly")} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Chat */}
      <CollapsibleSection title="Chat" icon="💬">
        <SettingsRow label="Chat Font Size" description="Text size for chat messages">
          <div className="flex items-center gap-2">
            <button onClick={() => u("chatFontSize", Math.max(10, props.chatFontSize - 1))}
              className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] flex items-center justify-center hover:bg-white/[0.08] transition-all cursor-pointer">−</button>
            <span className="text-[11px] text-white/60 font-mono w-6 text-center">{props.chatFontSize}</span>
            <button onClick={() => u("chatFontSize", Math.min(20, props.chatFontSize + 1))}
              className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] flex items-center justify-center hover:bg-white/[0.08] transition-all cursor-pointer">+</button>
          </div>
        </SettingsRow>
        <SettingsRow label="Chat Font Family" description="Font family for chat messages — any Google Font or system font">
          <input type="text" value={props.chatFontFamily} onChange={(e) => u("chatFontFamily", e.target.value)}
            placeholder="e.g. 'Inter', system-ui, 'Roboto Mono'" className="input-glass !w-[140px]" />
        </SettingsRow>
        <SettingsRow label="Chat Font Weight" description="Font weight for chat messages">
          <GlassSelect value={props.chatFontWeight} options={fontWeightOptions} onChange={(v) => u("chatFontWeight", v)} />
        </SettingsRow>
        <SettingsRow label="Chat Density" description="Spacing between chat messages">
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            {(["compact", "normal", "comfortable"] as const).map((d) => (
              <button key={d} onClick={() => u("chatDensity", d as ChatDensity)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all capitalize cursor-pointer border-none ${
                  props.chatDensity === d ? "bg-white/[0.08] text-white/80" : "text-white/25 hover:text-white/45 bg-transparent"
                }`}>{d}</button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Show Timestamps" description="Display time next to messages">
          <Toggle on={props.showTimestamps} onToggle={() => toggle("showTimestamps")} />
        </SettingsRow>
        <SettingsRow label="Show Badges" description="Display user badges in chat">
          <Toggle on={props.showBadges} onToggle={() => toggle("showBadges")} />
        </SettingsRow>
        <SettingsRow label="Chat Bubbles" description="Display messages as rounded bubble cards">
          <Toggle on={props.chatBubbles} onToggle={() => toggle("chatBubbles")} />
        </SettingsRow>
        <SettingsRow label="Platform Badges && Icons" description="Show platform-specific icons next to messages in chat">
          <Toggle on={props.platformBadges} onToggle={() => toggle("platformBadges")} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Effects */}
      <CollapsibleSection title="Effects" icon="✨">
        <SettingsRow label="Animations" description="Enable UI transitions and animations">
          <Toggle on={props.animationsEnabled} onToggle={() => toggle("animationsEnabled")} />
        </SettingsRow>
        <SettingsRow label="Glow Effects" description="Accent glow on buttons and indicators">
          <Toggle on={props.glowEffects} onToggle={() => toggle("glowEffects")} />
        </SettingsRow>
        <SettingsRow label="Holographic Borders" description="Holo effect on cards and panels">
          <Toggle on={props.holoEffects} onToggle={() => toggle("holoEffects")} />
        </SettingsRow>
        <SettingsRow label="Reduced Motion" description="Instantly terminate all hover translations and scales">
          <Toggle on={props.reducedMotion} onToggle={() => toggle("reducedMotion")} />
        </SettingsRow>
        <SettingsRow label="Transition Speed" description="Global animation speed">
          <GlassSelect value={props.transitionSpeed} options={transitionSpeedOptions} onChange={(v) => u("transitionSpeed", v as TransitionSpeed)} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Advanced Effects */}
      <CollapsibleSection title="Advanced Effects" icon="🔬">
        <SettingsRow label="Cover Breathe" description="Breathing animation on game cover art">
          <Toggle on={props.coverBreathe} onToggle={() => toggle("coverBreathe")} />
        </SettingsRow>
        <SettingsRow label="Cover Glint" description="Shimmer/glint effect on cover art">
          <Toggle on={props.coverGlint} onToggle={() => toggle("coverGlint")} />
        </SettingsRow>
        <SettingsRow label="Card Hover Lift" description="Cards lift on hover">
          <Toggle on={props.cardHoverLift} onToggle={() => toggle("cardHoverLift")} />
        </SettingsRow>
        <SettingsRow label="Card Glint" description="Glint effect on card hover">
          <Toggle on={props.cardGlint} onToggle={() => toggle("cardGlint")} />
        </SettingsRow>
        <SettingsRow label="Status Pulse" description="Pulsing status indicator">
          <Toggle on={props.statusPulse} onToggle={() => toggle("statusPulse")} />
        </SettingsRow>
        <SettingsRow label="Toast Animations" description="Animate toast notifications">
          <Toggle on={props.toastAnimations} onToggle={() => toggle("toastAnimations")} />
        </SettingsRow>
        <SettingsRow label="Modal Animations" description="Animate modal dialogs">
          <Toggle on={props.modalAnimations} onToggle={() => toggle("modalAnimations")} />
        </SettingsRow>
        <SettingsRow label="Progress Bar Animation" description="Animate progress bars">
          <Toggle on={props.progressBarAnimation} onToggle={() => toggle("progressBarAnimation")} />
        </SettingsRow>
        <SettingsRow label="Button Hover Effects" description="Hover effects on buttons">
          <Toggle on={props.buttonHoverEffects} onToggle={() => toggle("buttonHoverEffects")} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Preview */}
      <CollapsibleSection title="Preview" icon="👁">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="status-dot on" />
            <span className="text-[11px] text-white/50">Active indicator</span>
          </div>
          <button className="btn-cta">Primary Button</button>
          <div className="progress-track">
            <div className="progress-fill bg-gradient-to-r from-purple-500 to-indigo-500" style={{ width: "66%" }} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[9px] text-white/20 font-mono">12:34</span>
            <span className="text-[10px] text-white/40">PreviewUser</span>
            <span className="badge badge-ghost">BADGE</span>
            <span className="text-[11px] text-white/30">Sample message text</span>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
