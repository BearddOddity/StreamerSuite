// Multi-widget overlay editor — a Canvas overlay is several independently
// placed/sized/stacked widgets (each the same shape a standalone overlay
// uses, via TemplateFieldsEditor) on one page, instead of one widget per
// overlay file. See overlay_manager.rs's render_canvas for how each element
// stays a fully isolated document (a same-origin srcdoc iframe) so their
// CSS can never collide with each other.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TEMPLATES, newCanvasElement, type CanvasElementT, type TemplateParams } from "./types";
import { useLiveSources } from "./useLiveSources";
import TemplateFieldsEditor from "./TemplateFieldsEditor";
import { Button, Card, SectionHead } from "../../design-system/components/core";

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full input-glass text-[11px]"
      />
    </div>
  );
}

export default function CanvasMaker({
  onSaved,
  onClose,
  mode = "create",
  editFile,
  initialElements,
}: {
  onSaved: () => void;
  onClose: () => void;
  mode?: "create" | "edit";
  editFile?: string;
  initialElements?: CanvasElementT[];
}) {
  const [elements, setElements] = useState<CanvasElementT[]>(initialElements ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(initialElements?.[0]?.id ?? null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveSources = useLiveSources();
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      invoke<string>("overlay_preview_canvas", { elements })
        .then((html) => {
          setPreview(html);
          setError("");
        })
        .catch((e) => setError(String(e)));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [elements]);

  const addElement = (templateId: (typeof TEMPLATES)[number]["id"]) => {
    const el = newCanvasElement(templateId, elements.length);
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setShowTemplatePicker(false);
  };

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const setSelectedParam = <K extends keyof TemplateParams>(key: K, value: TemplateParams[K]) => {
    setElements((prev) =>
      prev.map((e) => (e.id === selectedId ? { ...e, params: { ...e.params, [key]: value } } : e))
    );
  };

  const setSelectedPlacement = (patch: Partial<Pick<CanvasElementT, "xPct" | "yPct" | "widthPct" | "heightPct" | "zIndex">>) => {
    setElements((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
  };

  const save = async () => {
    if (elements.length === 0) {
      setError("Add at least one element first");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && editFile) {
        await invoke("overlay_update_canvas", { file: editFile, elements });
      } else {
        await invoke("overlay_create_from_canvas", { elements });
      }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <Card padding={24} className="w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <SectionHead
            icon="🧩"
            title={mode === "edit" ? "Edit Canvas Overlay" : "Build a Canvas Overlay"}
            desc="Multiple widgets, placed and stacked freely, in one overlay"
            right={
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            }
          />
        </div>

        {error && (
          <Card padding={10} className="mb-3">
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
              {error}
            </p>
          </Card>
        )}

        <div className="grid grid-cols-[200px_1fr_1fr] gap-5">
          {/* Element list */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block">Elements</label>
            <div className="space-y-1.5">
              {elements.map((el) => {
                const t = TEMPLATES.find((t) => t.id === el.params.template)!;
                return (
                  <button
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`w-full text-left flex items-center gap-1.5 px-2.5 py-2 rounded-lg border transition-all ${
                      selectedId === el.id
                        ? "bg-purple-500/15 border-purple-500/40"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/15"
                    }`}
                  >
                    <span className="text-[13px]">{t.icon}</span>
                    <span className="text-[11px] text-white/70 flex-1 truncate">
                      {el.params.title.text || t.label}
                    </span>
                    <span
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeElement(el.id);
                      }}
                      className="text-[10px] text-white/20 hover:text-red-400 px-1"
                    >
                      ✕
                    </span>
                  </button>
                );
              })}
            </div>

            {showTemplatePicker ? (
              <div className="space-y-1 pt-1">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addElement(t.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-white/60 bg-white/[0.02] border border-white/[0.06] hover:border-white/15"
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
                <button onClick={() => setShowTemplatePicker(false)} className="w-full text-[10px] text-white/25 pt-1">
                  Cancel
                </button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowTemplatePicker(true)} className="w-full">
                + Add Element
              </Button>
            )}
          </div>

          {/* Selected element's fields */}
          <div>
            {selected ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="X (%)" value={selected.xPct} min={0} max={100} onChange={(v) => setSelectedPlacement({ xPct: v })} />
                  <NumberField label="Y (%)" value={selected.yPct} min={0} max={100} onChange={(v) => setSelectedPlacement({ yPct: v })} />
                  <NumberField label="Width (%)" value={selected.widthPct} min={2} max={100} onChange={(v) => setSelectedPlacement({ widthPct: v })} />
                  <NumberField label="Height (%)" value={selected.heightPct} min={2} max={100} onChange={(v) => setSelectedPlacement({ heightPct: v })} />
                  <div className="col-span-2">
                    <NumberField label="Layer (z-order, higher = on top)" value={selected.zIndex} min={0} max={99} onChange={(v) => setSelectedPlacement({ zIndex: v })} />
                  </div>
                </div>
                <TemplateFieldsEditor
                  params={selected.params}
                  set={setSelectedParam}
                  liveSources={liveSources}
                  showTemplatePicker={false}
                />
              </div>
            ) : (
              <p className="text-[11px] text-white/25 pt-2">
                {elements.length === 0 ? "Add an element to get started." : "Select an element to edit it."}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block">Live Preview</label>
            <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:20px_20px] aspect-video">
              {preview && (
                <iframe title="canvas-preview" srcDoc={preview} className="w-full h-full pointer-events-none" />
              )}
            </div>
            <p className="text-[10px] text-white/25">
              Position/size are percent of the canvas, so this holds up at any OBS Browser Source resolution.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="cta" onClick={save} disabled={saving}>
            {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Overlay"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
