// Fields for one free-form primitive layer (rect/ellipse/line/text/image) —
// the free-form counterpart to TemplateFieldsEditor's whole-widget form.
// Far fewer fields since a primitive is one shape, not a composed card.
import { BLEND_MODES, type ElementKind, type PrimitiveParams } from "../overlay-library/types";
import { ColorField, SELECT_COMPACT_STYLE } from "./TemplateFieldsEditor";
import { RangeSlider, Select } from "../../design-system/components/forms";
import { Button } from "../../design-system/components/core";

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

  return (
    <div className="space-y-4">
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

      {isImage && (
        <>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Image</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
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
