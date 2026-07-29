// Fields for one free-form primitive layer (rect/ellipse/line/text/image) —
// the free-form counterpart to TemplateFieldsEditor's whole-widget form.
// Far fewer fields since a primitive is one shape, not a composed card.
import { useState } from "react";
import { BLEND_MODES, type ElementKind, type PrimitiveParams } from "../overlay-library/types";
import { ICON_LIBRARY } from "./icons";
import { ColorField, SELECT_COMPACT_STYLE } from "./TemplateFieldsEditor";
import { RangeSlider, Select } from "../../design-system/components/forms";
import { Button } from "../../design-system/components/core";

/** A saved "look" — every style field except the two that are actually
 * content (`text`, `imageDataUri`), so one preset works across kinds: a
 * gradient+shadow combo saved from a rectangle applies the same way to an
 * ellipse, and a font+color combo saved from one text layer applies to
 * another. */
type StyleValues = Omit<PrimitiveParams, "text" | "imageDataUri">;
interface StylePreset {
  id: string;
  name: string;
  style: StyleValues;
}
const STYLE_PRESETS_KEY = "bd-overlay-style-presets";

function getStylePresets(): StylePreset[] {
  try {
    const raw = localStorage.getItem(STYLE_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStylePreset(name: string, style: StyleValues) {
  try {
    const next = [...getStylePresets(), { id: `style-${Date.now()}`, name, style }].slice(-20);
    localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — the preset just won't persist
  }
}

function deleteStylePreset(id: string) {
  try {
    localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(getStylePresets().filter((p) => p.id !== id)));
  } catch {
    // no-op
  }
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full input-glass text-[11px]"
      />
    </div>
  );
}

export default function PrimitiveFieldsEditor({
  kind,
  params,
  set,
}: {
  kind: ElementKind;
  params: PrimitiveParams;
  set: <K extends keyof PrimitiveParams>(key: K, value: PrimitiveParams[K]) => void;
}) {
  const hasFill = kind === "rect" || kind === "ellipse" || kind === "line";
  const hasStroke = kind === "rect" || kind === "ellipse";
  const hasCornerRadius = kind === "rect";
  const isText = kind === "text";
  const isImage = kind === "image";
  const isIcon = kind === "icon";

  const [presets, setPresets] = useState<StylePreset[]>(() => getStylePresets());
  const [presetName, setPresetName] = useState("");
  const [showPresetSave, setShowPresetSave] = useState(false);

  const applyPreset = (style: StyleValues) => {
    (Object.keys(style) as (keyof StyleValues)[]).forEach((key) => set(key, style[key]));
  };

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { text: _text, imageDataUri: _imageDataUri, ...style } = params;
    saveStylePreset(presetName.trim(), style);
    setPresets(getStylePresets());
    setPresetName("");
    setShowPresetSave(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Style Presets</label>
          <button onClick={() => setShowPresetSave((s) => !s)} className="text-[10px] text-white/40 hover:text-white/70">
            {showPresetSave ? "Cancel" : "+ Save Current"}
          </button>
        </div>
        {showPresetSave && (
          <div className="flex gap-1.5">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="flex-1 min-w-0 input-glass text-[11px]"
              onKeyDown={(e) => e.key === "Enter" && saveCurrentAsPreset()}
            />
            <Button variant="ghost" size="sm" onClick={saveCurrentAsPreset} disabled={!presetName.trim()}>
              Save
            </Button>
          </div>
        )}
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <div key={p.id} className="relative group">
                <button
                  onClick={() => applyPreset(p.style)}
                  title={`Apply "${p.name}"`}
                  className="px-2 py-1 pr-4 rounded-lg text-[10px] text-white/60 bg-white/[0.03] border border-white/[0.06] hover:border-white/20"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => {
                    deleteStylePreset(p.id);
                    setPresets(getStylePresets());
                  }}
                  title="Delete preset"
                  className="absolute top-1/2 -translate-y-1/2 right-1 w-3 h-3 rounded-full text-white/30 text-[8px] leading-none opacity-0 group-hover:opacity-100 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {hasFill && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Fill</label>
            <label className="flex items-center gap-1.5 text-[10px] text-white/50">
              <input
                type="checkbox"
                checked={params.fill !== "transparent"}
                onChange={(e) => set("fill", e.target.checked ? "#9146ff" : "transparent")}
              />
              Filled
            </label>
          </div>
          {params.fill !== "transparent" && (
            <>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Fill Type</label>
                <div className="flex gap-1">
                  {([
                    ["solid", "Solid"],
                    ["linear", "Linear"],
                    ["radial", "Radial"],
                  ] as [PrimitiveParams["fillType"], string][]).map(([ft, label]) => (
                    <button
                      key={ft}
                      onClick={() => set("fillType", ft)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] border ${
                        params.fillType === ft
                          ? "bg-purple-500/15 border-purple-500/40 text-white"
                          : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={params.fillType === "solid" ? "" : "grid grid-cols-2 gap-2"}>
                <ColorField label={params.fillType === "solid" ? "Fill Color" : "Color 1"} value={params.fill} onChange={(v) => set("fill", v)} />
                {params.fillType !== "solid" && (
                  <ColorField label="Color 2" value={params.fillColor2} onChange={(v) => set("fillColor2", v)} />
                )}
              </div>
              {params.fillType === "linear" && (
                <NumberField label="Gradient Angle (°)" value={params.gradientAngle} min={0} max={360} onChange={(v) => set("gradientAngle", v)} />
              )}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
                  Fill Opacity ({Math.round(params.fillOpacity * 100)}%)
                </label>
                <RangeSlider min={0} max={1} step={0.05} value={params.fillOpacity} onChange={(v) => set("fillOpacity", v)} showValue={false} />
              </div>
            </>
          )}
        </div>
      )}

      {hasStroke && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Stroke</label>
            <label className="flex items-center gap-1.5 text-[10px] text-white/50">
              <input
                type="checkbox"
                checked={params.stroke !== "transparent"}
                onChange={(e) => set("stroke", e.target.checked ? "#ffffff" : "transparent")}
              />
              Enabled
            </label>
          </div>
          {params.stroke !== "transparent" && (
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Stroke Color" value={params.stroke} onChange={(v) => set("stroke", v)} />
              <NumberField label="Width (px)" value={params.strokeWidth} min={0} max={40} onChange={(v) => set("strokeWidth", v)} />
            </div>
          )}
        </div>
      )}

      {hasCornerRadius && (
        <NumberField label="Corner Radius (px)" value={params.cornerRadius} min={0} max={500} onChange={(v) => set("cornerRadius", v)} />
      )}

      {isText && (
        <>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Text</label>
            <textarea
              value={params.text}
              onChange={(e) => set("text", e.target.value)}
              rows={2}
              className="w-full input-glass text-[12px] resize-none"
            />
          </div>
          <ColorField label="Text Color" value={params.textColor} onChange={(v) => set("textColor", v)} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Size (px)" value={params.fontSize} min={4} max={400} onChange={(v) => set("fontSize", v)} />
            <NumberField label="Weight" value={params.fontWeight} min={100} max={900} step={100} onChange={(v) => set("fontWeight", v)} />
          </div>
          <Select
            label="Font"
            value={params.fontFamily}
            onChange={(v) => set("fontFamily", v)}
            options={["", "Bebas Neue", "Anton", "Oswald", "Bungee", "Press Start 2P", "Poppins"].map((f) => ({ value: f, label: f || "System Default" }))}
            style={SELECT_COMPACT_STYLE}
          />
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Align</label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => set("textAlign", a)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] border ${
                    params.textAlign === a
                      ? "bg-purple-500/15 border-purple-500/40 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/20"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {isIcon && (
        <>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Icon</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICON_LIBRARY.map((icon) => (
                <button
                  key={icon.id}
                  title={icon.label}
                  onClick={() => set("iconId", icon.id)}
                  className={`aspect-square rounded-lg flex items-center justify-center border ${
                    params.iconId === icon.id
                      ? "bg-purple-500/15 border-purple-500/40 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/20"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" dangerouslySetInnerHTML={{ __html: icon.svg }} />
                </button>
              ))}
            </div>
          </div>
          <ColorField label="Color" value={params.fill} onChange={(v) => set("fill", v)} />
        </>
      )}

      {isImage && (
        <>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Image</label>
            <p className="text-[9px] text-white/25 mb-1.5">
              PNG/JPG or SVG — vector logos stay crisp at any size and any canvas resolution.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,.svg"
                className="hidden"
                id="primitive-image-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => set("imageDataUri", String(reader.result));
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => document.getElementById("primitive-image-upload")?.click()}>
                {params.imageDataUri ? "Replace…" : "Upload…"}
              </Button>
              {params.imageDataUri && (
                <Button variant="ghost" size="sm" onClick={() => set("imageDataUri", null)}>
                  Clear
                </Button>
              )}
            </div>
            {params.imageDataUri && (
              <img src={params.imageDataUri} alt="" className="mt-2 max-h-24 rounded-lg border border-white/10" />
            )}
          </div>
          <Select
            label="Fit"
            value={params.objectFit}
            onChange={(v) => set("objectFit", v as PrimitiveParams["objectFit"])}
            options={[
              { value: "contain", label: "Contain" },
              { value: "cover", label: "Cover" },
              { value: "fill", label: "Stretch" },
            ]}
            style={SELECT_COMPACT_STYLE}
          />
          {params.objectFit === "cover" && (
            <>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
                  Crop — Horizontal ({Math.round(params.objectPositionX)}%)
                </label>
                <RangeSlider
                  min={0}
                  max={100}
                  step={1}
                  value={params.objectPositionX}
                  onChange={(v) => set("objectPositionX", v)}
                  showValue={false}
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
                  Crop — Vertical ({Math.round(params.objectPositionY)}%)
                </label>
                <RangeSlider
                  min={0}
                  max={100}
                  step={1}
                  value={params.objectPositionY}
                  onChange={(v) => set("objectPositionY", v)}
                  showValue={false}
                />
              </div>
            </>
          )}
        </>
      )}

      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
          Overall Opacity ({Math.round(params.opacity * 100)}%)
        </label>
        <RangeSlider min={0} max={1} step={0.05} value={params.opacity} onChange={(v) => set("opacity", v)} showValue={false} />
      </div>

      <Select
        label="Blend Mode"
        value={params.blendMode}
        onChange={(v) => set("blendMode", v as PrimitiveParams["blendMode"])}
        options={BLEND_MODES.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
        style={SELECT_COMPACT_STYLE}
      />

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
            onChange={(v) => set("animationStyle", v as PrimitiveParams["animationStyle"])}
            options={[
              { value: "pop", label: "Pop" },
              { value: "slide", label: "Slide Up" },
              { value: "fade", label: "Fade" },
            ]}
            style={SELECT_COMPACT_STYLE}
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-[10px] text-white/50">
          <input type="checkbox" checked={params.shadow} onChange={(e) => set("shadow", e.target.checked)} />
          Drop Shadow
        </label>
        {params.shadow && (
          <>
            <ColorField label="Shadow Color" value={params.shadowColor} onChange={(v) => set("shadowColor", v)} />
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Blur" value={params.shadowBlur} min={0} max={120} onChange={(v) => set("shadowBlur", v)} />
              <NumberField label="Offset X" value={params.shadowOffsetX} min={-300} max={300} onChange={(v) => set("shadowOffsetX", v)} />
              <NumberField label="Offset Y" value={params.shadowOffsetY} min={-300} max={300} onChange={(v) => set("shadowOffsetY", v)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
