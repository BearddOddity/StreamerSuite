// Multi-widget overlay editor — a Canvas overlay is several independently
// placed/sized/stacked widgets (each the same shape a standalone overlay
// uses, via TemplateFieldsEditor) on one page, instead of one widget per
// overlay file. See overlay_manager.rs's render_canvas for how each element
// stays a fully isolated document (a same-origin srcdoc iframe) so their
// CSS can never collide with each other.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TEMPLATES, newCanvasElement, type CanvasElementT, type TemplateParams } from "../overlay-library/types";
import { useLiveSources } from "../overlay-library/useLiveSources";
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

const SNAP_THRESHOLD_PCT = 1.5;

/** Canvas center/edges plus every other element's left/center/right (x) or
 * top/center/bottom (y) edge — what a dragged/resized element can snap to,
 * same idea as Canva's alignment guides. */
function snapTargets(elements: CanvasElementT[], excludeId: string) {
  const xs = [0, 50, 100];
  const ys = [0, 50, 100];
  for (const e of elements) {
    if (e.id === excludeId) continue;
    xs.push(e.xPct, e.xPct + e.widthPct / 2, e.xPct + e.widthPct);
    ys.push(e.yPct, e.yPct + e.heightPct / 2, e.yPct + e.heightPct);
  }
  return { xs, ys };
}

function snap(value: number, targets: number[]): { value: number; hit: number | null } {
  for (const t of targets) {
    if (Math.abs(value - t) <= SNAP_THRESHOLD_PCT) return { value: t, hit: t };
  }
  return { value, hit: null };
}

type DragMode = "move" | "resize";
interface DragState {
  id: string;
  mode: DragMode;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  rectW: number;
  rectH: number;
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
  const [guideX, setGuideX] = useState<number | null>(null);
  const [guideY, setGuideY] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const liveSources = useLiveSources();
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  // Mouse-driven drag-to-move / handle-drag-to-resize with Canva-style
  // snapping to the canvas center/edges and other elements' edges — the
  // direct-manipulation interaction the number inputs alone don't give you.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPct = ((e.clientX - d.startMouseX) / d.rectW) * 100;
      const dyPct = ((e.clientY - d.startMouseY) / d.rectH) * 100;
      setElements((prev) => {
        const el = prev.find((e2) => e2.id === d.id);
        if (!el) return prev;
        const { xs, ys } = snapTargets(prev, d.id);
        let patch: Partial<CanvasElementT>;
        let hitX: number | null = null;
        let hitY: number | null = null;
        if (d.mode === "move") {
          const rawX = Math.min(100 - 2, Math.max(0, d.startX + dxPct));
          const rawY = Math.min(100 - 2, Math.max(0, d.startY + dyPct));
          const sx = snap(rawX, xs);
          const sy = snap(rawY, ys);
          hitX = sx.hit;
          hitY = sy.hit;
          patch = { xPct: sx.value, yPct: sy.value };
        } else {
          const rawW = Math.min(100 - d.startX, Math.max(4, d.startW + dxPct));
          const rawH = Math.min(100 - d.startY, Math.max(4, d.startH + dyPct));
          const sw = snap(d.startX + rawW, xs);
          const sh = snap(d.startY + rawH, ys);
          hitX = sw.hit;
          hitY = sh.hit;
          patch = { widthPct: sw.hit != null ? sw.value - d.startX : rawW, heightPct: sh.hit != null ? sh.value - d.startY : rawH };
        }
        setGuideX(hitX);
        setGuideY(hitY);
        return prev.map((e2) => (e2.id === d.id ? { ...e2, ...patch } : e2));
      });
    };
    const onUp = () => {
      dragRef.current = null;
      setGuideX(null);
      setGuideY(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent, el: CanvasElementT, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      id: el.id,
      mode,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: el.xPct,
      startY: el.yPct,
      startW: el.widthPct,
      startH: el.heightPct,
      rectW: rect.width,
      rectH: rect.height,
    };
  };

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
      <Card padding={24} className="w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

        <div className="grid grid-cols-[180px_320px_1fr] gap-5">
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

          {/* Canvas — drag an element to move it, drag its bottom-right handle
              to resize, both snapping to the canvas center/edges and other
              elements' edges (thin purple guide lines while snapped). */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block">Canvas</label>
            <div
              ref={canvasRef}
              className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:20px_20px] aspect-video select-none"
              onMouseDown={() => setSelectedId(null)}
            >
              {preview && (
                <iframe
                  title="canvas-preview"
                  srcDoc={preview}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              )}

              {elements.map((el) => {
                const t = TEMPLATES.find((tt) => tt.id === el.params.template)!;
                const isSelected = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => startDrag(e, el, "move")}
                    className={`absolute cursor-move border-2 rounded ${
                      isSelected ? "border-purple-400" : "border-white/15 hover:border-white/35"
                    }`}
                    style={{
                      left: `${el.xPct}%`,
                      top: `${el.yPct}%`,
                      width: `${el.widthPct}%`,
                      height: `${el.heightPct}%`,
                      zIndex: el.zIndex + 1,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[9px] text-white/50 whitespace-nowrap">
                      {t.icon} {el.params.title.text || t.label}
                    </span>
                    <div
                      onMouseDown={(e) => startDrag(e, el, "resize")}
                      className={`absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm cursor-nwse-resize ${
                        isSelected ? "bg-purple-400" : "bg-white/30"
                      }`}
                    />
                  </div>
                );
              })}

              {guideX != null && (
                <div className="absolute top-0 bottom-0 w-px bg-purple-400/80 pointer-events-none" style={{ left: `${guideX}%` }} />
              )}
              {guideY != null && (
                <div className="absolute left-0 right-0 h-px bg-purple-400/80 pointer-events-none" style={{ top: `${guideY}%` }} />
              )}
            </div>
            <p className="text-[10px] text-white/25">
              Drag an element to move it, or its corner handle to resize — snaps to the canvas center/edges and
              other elements. Position/size are percent-based, so this holds up at any OBS Browser Source resolution.
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
