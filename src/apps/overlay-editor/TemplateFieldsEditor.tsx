// Every field for configuring one template-based widget — template type,
// bound title/subtitle, colors, position, font, animation, effects, logo.
// Shared by OverlayMaker (a whole overlay = one of these) and CanvasMaker
// (a whole overlay = several of these, each independently placed), so a
// widget's own settings never drift between the two editors.
import { useState } from "react";
import { DEFAULT_TEMPLATE_PARAMS, TEMPLATES, type BoundField, type TemplateParams } from "../overlay-library/types";
import { RangeSlider, Select } from "../../design-system/components/forms";

const FONT_PRESETS = ["", "Bebas Neue", "Anton", "Oswald", "Bungee", "Press Start 2P", "Poppins"];

const RECENT_COLORS_KEY = "bd-overlay-recent-colors";

function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function pushRecentColor(color: string) {
  try {
    const next = [color, ...getRecentColors().filter((c) => c !== color)].slice(0, 8);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, quota) — recent colors just won't persist
  }
}

// A deliberately-curated palette, distinct from "recent" (which is
// automatic and unlabeled history) — you choose what goes in it and it
// stays until you remove it, e.g. a brand's exact accent colors kept handy
// across every overlay you ever build.
const SAVED_PALETTE_KEY = "bd-overlay-saved-palette";

function getSavedPalette(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_PALETTE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function saveToPalette(color: string) {
  try {
    const next = [...getSavedPalette().filter((c) => c !== color), color].slice(-16);
    localStorage.setItem(SAVED_PALETTE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — the pin just won't persist
  }
}

function removeFromPalette(color: string) {
  try {
    localStorage.setItem(SAVED_PALETTE_KEY, JSON.stringify(getSavedPalette().filter((c) => c !== color)));
  } catch {
    // no-op
  }
}

/** A color picker plus two swatch rows: the last few colors used anywhere
 * (automatic, unlabeled) and a deliberately-saved palette (pin/unpin, kept
 * until you remove it) — makes it fast to keep every widget on a matching
 * set of brand colors without re-typing (or re-eyedropping) the same hex
 * code each time. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [recent, setRecent] = useState<string[]>(() => getRecentColors());
  const [palette, setPalette] = useState<string[]>(() => getSavedPalette());

  const commit = (v: string) => {
    onChange(v);
    pushRecentColor(v);
    setRecent(getRecentColors());
  };

  const pinCurrent = () => {
    saveToPalette(value);
    setPalette(getSavedPalette());
  };

  const unpin = (c: string) => {
    removeFromPalette(c);
    setPalette(getSavedPalette());
  };

  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => commit(e.target.value)}
        className="w-full h-9 rounded-lg bg-transparent border border-white/[0.06]"
      />
      {recent.length > 0 && (
        <div className="flex gap-1 mt-1">
          {recent.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => commit(c)}
              title={c}
              className="w-4 h-4 rounded border border-white/20 shrink-0"
              style={{ background: c }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {palette.map((c) => (
          <div key={c} className="relative group">
            <button
              type="button"
              onClick={() => commit(c)}
              title={c}
              className="w-4 h-4 rounded border border-white/30 shrink-0"
              style={{ background: c }}
            />
            <button
              type="button"
              onClick={() => unpin(c)}
              title="Remove from saved palette"
              className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-black/80 border border-white/30 text-white/60 text-[7px] leading-none opacity-0 group-hover:opacity-100 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={pinCurrent}
          title="Save this color to your palette"
          className="w-4 h-4 rounded border border-dashed border-white/30 text-white/40 text-[9px] leading-none flex items-center justify-center hover:border-white/60 hover:text-white/70"
        >
          +
        </button>
      </div>
    </div>
  );
}

// The design system's Select defaults to a 16px web-form trigger font; this app's
// chrome runs 11-13px everywhere else (see design-system/README.md), so every
// Select in this dense modal opts into the smaller size to match its neighbors.
export const SELECT_COMPACT_STYLE = { fontSize: 12, padding: "10px 12px" };

function FieldRow({
  label,
  field,
  onChange,
  sourceOnly,
  sources,
}: {
  label: string;
  field: BoundField;
  onChange: (field: BoundField) => void;
  /** Goal Bar's "current value" field — only the live source matters, there's no visible text. */
  sourceOnly?: boolean;
  sources: { value: string; label: string }[];
}) {
  // A saved binding whose source no longer shows up among either the known
  // or currently-discovered live sources is "dead" — most likely the tool
  // that used to publish it was removed/renamed, or hasn't run yet this
  // session. Purely a heads-up (the field still saves fine either way).
  const isDead = field.source.trim() !== "" && !sources.some((s) => s.value === field.source);

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-white/40 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        {!sourceOnly && (
          <input
            value={field.text}
            onChange={(e) => onChange({ ...field, text: e.target.value })}
            placeholder={field.source ? "Label prefix (optional)" : "Text"}
            className="flex-1 min-w-0 input-glass text-[12px]"
          />
        )}
        <div className={`shrink-0 ${sourceOnly ? "flex-1" : "w-44"}`}>
          <Select
            value={field.source}
            onChange={(v) => onChange({ ...field, source: v })}
            options={isDead ? [{ value: field.source, label: `⚠ ${field.source} (not found)` }, ...sources] : sources}
            style={SELECT_COMPACT_STYLE}
          />
        </div>
      </div>
      {isDead && (
        <p className="text-[10px]" style={{ color: "var(--bd-red-text)" }}>
          ⚠ "{field.source}" isn't a known or currently-published live source — this field may show nothing until
          that source is available, or pick a different one.
        </p>
      )}
    </div>
  );
}

/** Relative luminance of a `#rrggbb`/`#rgb` hex color (WCAG formula). */
function luminance(hex: string): number {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const n = parseInt(full.slice(1), 16);
  if (Number.isNaN(n) || full.length !== 7) return 1;
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, 1 (identical) to 21 (max). */
function contrastRatio(a: string, b: string): number {
  const sorted = [luminance(a), luminance(b)].sort((x, y) => y - x);
  const l1 = sorted[0] ?? 1;
  const l2 = sorted[1] ?? 0;
  return (l1 + 0.05) / (l2 + 0.05);
}

export { DEFAULT_TEMPLATE_PARAMS };

export default function TemplateFieldsEditor({
  params,
  set,
  liveSources,
  showTemplatePicker = true,
}: {
  params: TemplateParams;
  set: <K extends keyof TemplateParams>(key: K, value: TemplateParams[K]) => void;
  liveSources: { value: string; label: string }[];
  /** OverlayMaker shows the template grid inline above these fields;
   * CanvasMaker picks a template once when adding an element instead, so it
   * skips this to avoid a second, redundant picker per element. */
  showTemplatePicker?: boolean;
}) {
  const template = TEMPLATES.find((t) => t.id === params.template)!;
  // These two replicate a fixed StatusForge design (Now Playing card / Game
  // Logo) pixel-for-pixel — text, colors, font, and art all come live from
  // StatusForge's own polling, not from anything typed here, so every field
  // below that would just be ignored gets hidden instead of shown-but-inert.
  const isStatusForgeCard = template.id === "now-playing" || template.id === "game-logo";

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoDataUri", String(reader.result));
    reader.readAsDataURL(file);
  };

  const pickFont = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      set("customFontDataUri", String(reader.result));
      set("customFontName", file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {showTemplatePicker && (
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Template</label>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => set("template", t.id)}
                className={`text-left p-2.5 rounded-lg border transition-all ${
                  params.template === t.id
                    ? "bg-purple-500/15 border-purple-500/40"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/15"
                }`}
              >
                <div className="text-[12px] font-semibold text-white/80">
                  {t.icon} {t.label}
                </div>
                <div className="text-[10px] text-white/30 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isStatusForgeCard && (
        <p className="text-[10px] text-white/30 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
          This replicates StatusForge's built-in {template.label} design exactly — text, art, and colors are
          always pulled live from whatever's currently playing, so there's nothing to type here beyond a layout
          below.
        </p>
      )}

      {!isStatusForgeCard && (
        <FieldRow
          label={template.id === "goal-bar" ? "Label" : template.id === "cam-frame" ? "Corner Label (optional)" : "Title"}
          field={params.title}
          onChange={(f) => set("title", f)}
          sources={liveSources}
        />
      )}
      {!isStatusForgeCard && template.id !== "cam-frame" && (
        <FieldRow
          label={template.id === "goal-bar" ? "Current Value" : "Subtitle"}
          field={params.subtitle}
          onChange={(f) => set("subtitle", f)}
          sourceOnly={template.id === "goal-bar"}
          sources={liveSources}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {template.positions.length > 0 && (
          <Select
            label="Position"
            value={params.position}
            onChange={(v) => set("position", v)}
            options={template.positions}
            style={SELECT_COMPACT_STYLE}
          />
        )}
        {template.hasSpeed && (
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
              Scroll Speed (sec)
            </label>
            <input
              type="number"
              min={4}
              max={120}
              value={params.speedSeconds ?? 18}
              onChange={(e) => set("speedSeconds", Number(e.target.value))}
              className="w-full input-glass text-[11px]"
            />
          </div>
        )}
        {template.hasGoal && (
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Goal</label>
            <input
              type="number"
              min={1}
              value={params.goal ?? 1000}
              onChange={(e) => set("goal", Number(e.target.value))}
              className="w-full input-glass text-[11px]"
            />
          </div>
        )}
        {template.hasCountdownTarget && (
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Counts down to</label>
            <input
              type="datetime-local"
              value={params.countdownTarget}
              onChange={(e) => set("countdownTarget", e.target.value)}
              className="w-full input-glass text-[11px]"
            />
          </div>
        )}
      </div>

      {!isStatusForgeCard && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Text Color" value={params.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField label="Accent Color" value={params.accentColor} onChange={(v) => set("accentColor", v)} />
          </div>
          {params.bgOpacity >= 0.4 && contrastRatio(params.textColor, "#050505") < 3 && (
            <p className="text-[10px] -mt-2" style={{ color: "var(--bd-red-text)" }}>
              ⚠ This text color is hard to read against the card's dark background at{" "}
              {Math.round(params.bgOpacity * 100)}% opacity — consider a lighter text color or lowering opacity.
            </p>
          )}

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
              Background Opacity ({Math.round(params.bgOpacity * 100)}%)
            </label>
            <RangeSlider min={0} max={1} step={0.05} value={params.bgOpacity} onChange={(v) => set("bgOpacity", v)} showValue={false} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Font"
              value={params.fontFamily}
              onChange={(v) => set("fontFamily", v)}
              options={FONT_PRESETS.map((f) => ({ value: f, label: f || "System Default" }))}
              style={SELECT_COMPACT_STYLE}
              disabled={!!params.customFontDataUri}
            />
            <Select
              label="Corner Style"
              value={params.borderRadius}
              onChange={(v) => set("borderRadius", v as TemplateParams["borderRadius"])}
              options={[
                { value: "sharp", label: "Sharp" },
                { value: "soft", label: "Soft" },
                { value: "rounded", label: "Rounded" },
              ]}
              style={SELECT_COMPACT_STYLE}
            />
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
              Custom Font Upload (optional — overrides the preset above)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={(e) => pickFont(e.target.files?.[0])}
                className="text-[11px] text-white/50"
              />
              {params.customFontDataUri && (
                <button
                  onClick={() => {
                    set("customFontDataUri", null);
                    set("customFontName", "");
                  }}
                  className="text-[10px] text-white/25 hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
            {params.customFontDataUri && <p className="text-[10px] text-white/30 mt-1">Using "{params.customFontName}"</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60">Entrance animation</label>
              <input
                type="checkbox"
                checked={params.animationsEnabled}
                onChange={(e) => set("animationsEnabled", e.target.checked)}
              />
            </div>
            {params.animationsEnabled && (
              <Select
                label="Animation Style"
                value={params.animationStyle}
                onChange={(v) => set("animationStyle", v as TemplateParams["animationStyle"])}
                options={[
                  { value: "pop", label: "Pop" },
                  { value: "slide", label: "Slide Up" },
                  { value: "fade", label: "Fade" },
                ]}
                style={SELECT_COMPACT_STYLE}
              />
            )}
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60">Text drop shadow</label>
              <input
                type="checkbox"
                checked={params.textShadow}
                onChange={(e) => set("textShadow", e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60">Text outline</label>
              <input
                type="checkbox"
                checked={params.textStroke}
                onChange={(e) => set("textStroke", e.target.checked)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
              Logo / Image (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickLogo(e.target.files?.[0])}
                className="text-[11px] text-white/50"
              />
              {params.logoDataUri && (
                <button onClick={() => set("logoDataUri", null)} className="text-[10px] text-white/25 hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
