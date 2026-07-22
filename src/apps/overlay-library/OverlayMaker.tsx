import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_TEMPLATE_PARAMS, LIVE_SOURCES, TEMPLATES, type BoundField, type TemplateParams } from "./types";

const FONT_PRESETS = ["", "Bebas Neue", "Anton", "Oswald", "Bungee", "Press Start 2P", "Poppins"];

function FieldRow({
  label,
  field,
  onChange,
}: {
  label: string;
  field: BoundField;
  onChange: (field: BoundField) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-white/40 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        <input
          value={field.text}
          onChange={(e) => onChange({ ...field, text: e.target.value })}
          placeholder={field.source ? "Label prefix (optional)" : "Text"}
          className="flex-1 input-glass text-[12px]"
        />
        <select
          value={field.source}
          onChange={(e) => onChange({ ...field, source: e.target.value })}
          className="input-glass text-[11px] w-44"
        >
          {LIVE_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function OverlayMaker({
  onSaved,
  onClose,
}: {
  onSaved: () => void;
  onClose: () => void;
}) {
  const [params, setParams] = useState<TemplateParams>(DEFAULT_TEMPLATE_PARAMS);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = TEMPLATES.find((t) => t.id === params.template)!;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      invoke<string>("overlay_preview_template", { params })
        .then((html) => {
          setPreview(html);
          setError("");
        })
        .catch((e) => setError(String(e)));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [params]);

  const set = <K extends keyof TemplateParams>(key: K, value: TemplateParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoDataUri", String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await invoke("overlay_create_from_template", { params });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="card-glass w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-white/90">🎨 Build an Overlay</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-[13px]">
            ✕
          </button>
        </div>

        {error && (
          <div className="surface-glass p-2.5 mb-3">
            <p className="text-[11px] text-red-400/70">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
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

            <FieldRow label="Title" field={params.title} onChange={(f) => set("title", f)} />
            <FieldRow label="Subtitle" field={params.subtitle} onChange={(f) => set("subtitle", f)} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Position</label>
                <select
                  value={params.position}
                  onChange={(e) => set("position", e.target.value)}
                  className="w-full input-glass text-[11px]"
                >
                  {template.positions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
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
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
                  Accent Color
                </label>
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
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">Font</label>
                <select
                  value={params.fontFamily}
                  onChange={(e) => set("fontFamily", e.target.value)}
                  className="w-full input-glass text-[11px]"
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f} value={f}>
                      {f || "System Default"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5 block">
                  Corner Style
                </label>
                <select
                  value={params.borderRadius}
                  onChange={(e) => set("borderRadius", e.target.value as TemplateParams["borderRadius"])}
                  className="w-full input-glass text-[11px]"
                >
                  <option value="sharp">Sharp</option>
                  <option value="soft">Soft</option>
                  <option value="rounded">Rounded</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60">Entrance animation</label>
              <input
                type="checkbox"
                checked={params.animationsEnabled}
                onChange={(e) => set("animationsEnabled", e.target.checked)}
              />
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

          <div className="space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block">Live Preview</label>
            <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:20px_20px] aspect-video">
              {preview && (
                <iframe title="overlay-preview" srcDoc={preview} className="w-full h-full pointer-events-none" />
              )}
            </div>
            <p className="text-[10px] text-white/25">
              Checkered background simulates OBS transparency. Live-bound fields show a placeholder here — they'll
              update for real once the overlay is added to a scene.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost text-[12px] px-4 py-2">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-[12px] px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Overlay"}
          </button>
        </div>
      </div>
    </div>
  );
}
