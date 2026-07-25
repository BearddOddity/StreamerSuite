// Every field for configuring one template-based widget — template type,
// bound title/subtitle, colors, position, font, animation, effects, logo.
// Shared by OverlayMaker (a whole overlay = one of these) and CanvasMaker
// (a whole overlay = several of these, each independently placed), so a
// widget's own settings never drift between the two editors.
import { DEFAULT_TEMPLATE_PARAMS, TEMPLATES, type BoundField, type TemplateParams } from "./types";
import { Select } from "../../design-system/components/forms";

const FONT_PRESETS = ["", "Bebas Neue", "Anton", "Oswald", "Bungee", "Press Start 2P", "Poppins"];

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
            options={sources}
            style={SELECT_COMPACT_STYLE}
          />
        </div>
      </div>
    </div>
  );
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

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoDataUri", String(reader.result));
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
                className={`text-left p-2.5 rounded-xl border transition-all ${
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

      <FieldRow
        label={template.id === "goal-bar" ? "Label" : template.id === "cam-frame" ? "Corner Label (optional)" : "Title"}
        field={params.title}
        onChange={(f) => set("title", f)}
        sources={liveSources}
      />
      {template.id !== "cam-frame" && (
        <FieldRow
          label={template.id === "goal-bar" ? "Current Value" : "Subtitle"}
          field={params.subtitle}
          onChange={(f) => set("subtitle", f)}
          sourceOnly={template.id === "goal-bar"}
          sources={liveSources}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Position"
          value={params.position}
          onChange={(v) => set("position", v)}
          options={template.positions}
          style={SELECT_COMPACT_STYLE}
        />
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Text Color</label>
          <input
            type="color"
            value={params.textColor}
            onChange={(e) => set("textColor", e.target.value)}
            className="w-full h-9 rounded-lg bg-transparent border border-white/[0.06]"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Accent Color</label>
          <input
            type="color"
            value={params.accentColor}
            onChange={(e) => set("accentColor", e.target.value)}
            className="w-full h-9 rounded-lg bg-transparent border border-white/[0.06]"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
          Background Opacity ({Math.round(params.bgOpacity * 100)}%)
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={params.bgOpacity}
          onChange={(e) => set("bgOpacity", Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Font"
          value={params.fontFamily}
          onChange={(v) => set("fontFamily", v)}
          options={FONT_PRESETS.map((f) => ({ value: f, label: f || "System Default" }))}
          style={SELECT_COMPACT_STYLE}
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
    </div>
  );
}
