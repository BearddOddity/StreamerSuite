// Multi-widget overlay editor — a Canvas overlay is several independently
// placed/sized/stacked widgets (each the same shape a standalone overlay
// uses, via TemplateFieldsEditor) on one page, instead of one widget per
// overlay file. See overlay_manager.rs's render_canvas for how each element
// stays a fully isolated document (a same-origin srcdoc iframe) so their
// CSS can never collide with each other.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  TEMPLATES,
  PRIMITIVES,
  newCanvasElement,
  newPrimitiveElement,
  elementKind,
  DEFAULT_PRIMITIVE_PARAMS,
  type CanvasElementT,
  type TemplateParams,
  type PrimitiveParams,
} from "../overlay-library/types";
import { useLiveSources } from "../overlay-library/useLiveSources";
import TemplateFieldsEditor from "./TemplateFieldsEditor";
import PrimitiveFieldsEditor from "./PrimitiveFieldsEditor";
import { SaveChoiceDialog, UnsavedChangesDialog } from "./ConfirmDialogs";
import VersionHistoryPanel from "./VersionHistoryPanel";
import { Button, Card, SectionHead } from "../../design-system/components/core";
import { Tooltip } from "../../design-system/components/overlay";

/** Icon + display label for a Layers row or the on-canvas floating label —
 * a template widget uses its TEMPLATES entry (icon + title/type name); a
 * primitive uses its PRIMITIVES entry (icon + shape name, or its own text
 * for a Text layer so multiple text layers are distinguishable at a glance). */
function elementIconLabel(el: CanvasElementT): { icon: string; label: string } {
  const kind = elementKind(el);
  if (kind === "template") {
    const t = TEMPLATES.find((tt) => tt.id === el.params.template);
    return { icon: t?.icon ?? "▭", label: el.params.title.text || t?.label || "Widget" };
  }
  const p = PRIMITIVES.find((pp) => pp.id === kind)!;
  const label = kind === "text" && el.primitive?.text ? el.primitive.text.slice(0, 24) : p.label;
  return { icon: p.icon, label };
}

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
/** The underlying preview iframe renders at this true pixel size and gets
 * CSS-scaled down to fit the canvas box — same idea as ScaledPreview's
 * "Actual Size" mode, always on here since there's no scenario where you'd
 * want the drag surface showing misleading (non-real-resolution) proportions
 * while placing elements. */
const NATIVE_W = 1920;
const NATIVE_H = 1080;

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

/** Angle (degrees) from a shape's center to the mouse, offset so "straight
 * up" (where the rotate handle sits, since the handle is a child of the
 * same rotated box and so already tracks the shape's current rotation
 * visually) reads as 0° — matches render_canvas's own rotate(deg). */
function angleFromCenter(centerX: number, centerY: number, mouseX: number, mouseY: number): number {
  return (Math.atan2(mouseY - centerY, mouseX - centerX) * 180) / Math.PI + 90;
}

interface RotateState {
  id: string;
  centerX: number;
  centerY: number;
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
  /** Other elements sharing this element's groupId, and where they started —
   * a move drag applies the anchor's own (post-snap) delta to each of these
   * so the whole group slides together. Empty for an ungrouped element or a
   * resize (resizing only ever affects the one element being resized). */
  groupStarts: { id: string; startX: number; startY: number }[];
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
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const initialSnapshotRef = useRef(JSON.stringify(initialElements ?? []));
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [guideY, setGuideY] = useState<number | null>(null);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [past, setPast] = useState<CanvasElementT[][]>([]);
  const [future, setFuture] = useState<CanvasElementT[][]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showSaveChoice, setShowSaveChoice] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elId: string } | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const rotateRef = useRef<RotateState | null>(null);
  const pendingBeforeRef = useRef<CanvasElementT[] | null>(null);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const liveSources = useLiveSources();
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  // Group/lock actions act on whichever is "selected" right now — the
  // multi-select set from Ctrl/Shift-clicking Layers rows when there is
  // one, otherwise just the single primary selection.
  const effectiveSelection = multiSelected.size > 0 ? multiSelected : selectedId ? new Set([selectedId]) : new Set<string>();
  const isDirty = JSON.stringify(elements) !== initialSnapshotRef.current;

  const requestClose = () => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const toggleLock = (id: string) => {
    recordBeforeChange(elements);
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, locked: !e.locked } : e)));
  };

  const groupSelected = () => {
    if (effectiveSelection.size < 2) return;
    recordBeforeChange(elements);
    const groupId = `group-${Date.now()}`;
    setElements((prev) => prev.map((e) => (effectiveSelection.has(e.id) ? { ...e, groupId } : e)));
  };

  const ungroupSelected = () => {
    recordBeforeChange(elements);
    setElements((prev) => prev.map((e) => (effectiveSelection.has(e.id) ? { ...e, groupId: null } : e)));
  };

  const toggleMultiSelect = (id: string) => {
    setMultiSelected((prev) => {
      const next = new Set(prev.size > 0 ? prev : selectedId ? [selectedId] : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedId(id);
  };

  // Undo/redo — every mutation (add/remove/drag/resize/field edit/reorder)
  // records the state right before it changed, coalesced into one history
  // step per burst (a drag's many mousemoves, or a run of keystrokes) via a
  // short debounce rather than one step per individual event.
  const recordBeforeChange = (before: CanvasElementT[]) => {
    if (pendingBeforeRef.current === null) pendingBeforeRef.current = before;
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      if (pendingBeforeRef.current) {
        setPast((p) => [...p.slice(-49), pendingBeforeRef.current!]);
        setFuture([]);
      }
      pendingBeforeRef.current = null;
    }, 400);
  };

  /** Commits any still-debounced change into `past` immediately, without
   * waiting out the rest of the debounce window. */
  const flushPendingToPast = () => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    if (pendingBeforeRef.current !== null) {
      setPast((p) => [...p.slice(-49), pendingBeforeRef.current!]);
      setFuture([]);
      pendingBeforeRef.current = null;
    }
  };

  const undo = () => {
    // A change still sitting in the debounce window (e.g. Ctrl+D followed
    // immediately by Ctrl+Z) hasn't reached `past` yet — undo straight to
    // it instead of reading `past` and finding nothing there.
    if (pendingBeforeRef.current !== null) {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      const target = pendingBeforeRef.current;
      pendingBeforeRef.current = null;
      setFuture((f) => [elements, ...f].slice(0, 50));
      setElements(target);
      setSelectedId(null);
      return;
    }
    if (past.length === 0) return;
    const prevState = past[past.length - 1]!;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [elements, ...f].slice(0, 50));
    setElements(prevState);
    setSelectedId(null);
  };

  const redo = () => {
    flushPendingToPast();
    if (future.length === 0) return;
    const nextState = future[0]!;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, elements].slice(-50));
    setElements(nextState);
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    recordBeforeChange(elements);
    const copy: CanvasElementT = {
      ...selected,
      id: `el-${Date.now()}`,
      params: { ...selected.params },
      primitive: selected.primitive ? { ...selected.primitive } : undefined,
      xPct: Math.min(96, selected.xPct + 3),
      yPct: Math.min(96, selected.yPct + 3),
      zIndex: elements.length,
    };
    setElements((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeElement(selected.id);
        return;
      }
      // Arrow-key nudge — 1% per press, 5% with Shift, matching the same
      // percent-of-canvas units the mouse drag and number inputs use.
      const step = e.shiftKey ? 5 : 1;
      if (!selected.locked && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        recordBeforeChange(elements);
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setElements((prev) =>
          prev.map((el) =>
            el.id === selected.id
              ? { ...el, xPct: Math.min(98, Math.max(0, el.xPct + dx)), yPct: Math.min(98, Math.max(0, el.yPct + dy)) }
              : el
          )
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [past, future, elements, selected]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [contextMenu]);

  // Mouse-driven drag-to-move / handle-drag-to-resize with Canva-style
  // snapping to the canvas center/edges and other elements' edges — the
  // direct-manipulation interaction the number inputs alone don't give you.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = rotateRef.current;
      if (r) {
        const angle = Math.round(angleFromCenter(r.centerX, r.centerY, e.clientX, e.clientY));
        setElements((prev) => {
          recordBeforeChange(prev);
          return prev.map((e2) => (e2.id === r.id ? { ...e2, rotation: angle } : e2));
        });
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      const dxPct = ((e.clientX - d.startMouseX) / d.rectW) * 100;
      const dyPct = ((e.clientY - d.startMouseY) / d.rectH) * 100;
      setElements((prev) => {
        const el = prev.find((e2) => e2.id === d.id);
        if (!el) return prev;
        recordBeforeChange(prev);
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
          // Group members ride along with the dragged element's own
          // (post-snap) delta, each measured from where it started —
          // the delta never accumulates across mousemoves.
          if (d.groupStarts.length > 0) {
            const groupDx = sx.value - d.startX;
            const groupDy = sy.value - d.startY;
            const byId = new Map(d.groupStarts.map((g) => [g.id, g]));
            return prev.map((e2) => {
              if (e2.id === d.id) return { ...e2, ...patch };
              const g = byId.get(e2.id);
              if (!g) return e2;
              return { ...e2, xPct: Math.min(98, Math.max(0, g.startX + groupDx)), yPct: Math.min(98, Math.max(0, g.startY + groupDy)) };
            });
          }
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
      rotateRef.current = null;
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
    setMultiSelected(new Set());
    if (el.locked) return; // still selectable (to unlock/inspect it), just not draggable
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const groupStarts =
      mode === "move" && el.groupId
        ? elements.filter((e2) => e2.groupId === el.groupId && e2.id !== el.id && !e2.locked).map((e2) => ({ id: e2.id, startX: e2.xPct, startY: e2.yPct }))
        : [];
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
      groupStarts,
    };
  };

  const startRotate = (e: React.MouseEvent, el: CanvasElementT) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    setMultiSelected(new Set());
    if (el.locked) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    rotateRef.current = {
      id: el.id,
      centerX: rect.left + ((el.xPct + el.widthPct / 2) / 100) * rect.width,
      centerY: rect.top + ((el.yPct + el.heightPct / 2) / 100) * rect.height,
    };
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setCanvasScale(el.clientWidth / NATIVE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    recordBeforeChange(elements);
    const el = newCanvasElement(templateId, elements.length);
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setShowTemplatePicker(false);
  };

  const addPrimitive = (kind: (typeof PRIMITIVES)[number]["id"]) => {
    recordBeforeChange(elements);
    const el = newPrimitiveElement(kind, elements.length);
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    setShowTemplatePicker(false);
  };

  const removeElement = (id: string) => {
    recordBeforeChange(elements);
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const setSelectedParam = <K extends keyof TemplateParams>(key: K, value: TemplateParams[K]) => {
    recordBeforeChange(elements);
    setElements((prev) =>
      prev.map((e) => (e.id === selectedId ? { ...e, params: { ...e.params, [key]: value } } : e))
    );
  };

  const setSelectedPrimitive = <K extends keyof PrimitiveParams>(key: K, value: PrimitiveParams[K]) => {
    recordBeforeChange(elements);
    setElements((prev) =>
      prev.map((e) =>
        e.id === selectedId
          ? { ...e, primitive: { ...(e.primitive ?? DEFAULT_PRIMITIVE_PARAMS), [key]: value } }
          : e
      )
    );
  };

  const setSelectedPlacement = (patch: Partial<Pick<CanvasElementT, "xPct" | "yPct" | "widthPct" | "heightPct" | "zIndex" | "rotation">>) => {
    recordBeforeChange(elements);
    setElements((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
  };

  /** Generates a whole layout from a text description via Hugging Face
   * (same real-call pattern as AI Co-Host, not a mockup) and replaces the
   * canvas with it — undoable like any other change, so a bad result is
   * one Ctrl+Z away from gone. Adds to an empty canvas or on top of
   * existing elements depending on what's already there isn't attempted
   * here; it always replaces, since merging AI output with hand-placed
   * elements risks landing them on top of each other. */
  const generateWithAi = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError("");
    try {
      const result = await invoke<{ elements: CanvasElementT[] }>("overlay_generate_canvas_from_prompt", {
        prompt: aiPrompt.trim(),
        model: "",
      });
      recordBeforeChange(elements);
      setElements(result.elements);
      setSelectedId(result.elements[0]?.id ?? null);
      setShowAiPanel(false);
      setAiPrompt("");
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiBusy(false);
    }
  };

  type AlignTo = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

  const alignSelected = (align: AlignTo) => {
    if (!selected) return;
    recordBeforeChange(elements);
    const patch: Partial<CanvasElementT> =
      align === "left"
        ? { xPct: 0 }
        : align === "centerH"
          ? { xPct: Math.max(0, (100 - selected.widthPct) / 2) }
          : align === "right"
            ? { xPct: Math.max(0, 100 - selected.widthPct) }
            : align === "top"
              ? { yPct: 0 }
              : align === "centerV"
                ? { yPct: Math.max(0, (100 - selected.heightPct) / 2) }
                : { yPct: Math.max(0, 100 - selected.heightPct) };
    setElements((prev) => prev.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)));
  };

  const bringToFront = (id: string) => {
    recordBeforeChange(elements);
    const maxZ = elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, zIndex: maxZ + 1 } : e)));
  };

  const sendToBack = (id: string) => {
    recordBeforeChange(elements);
    const minZ = elements.reduce((m, e) => Math.min(m, e.zIndex), 0);
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, zIndex: minZ - 1 } : e)));
  };

  const exportCanvas = () => {
    if (elements.length === 0) return;
    const blob = new Blob([JSON.stringify({ elements }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "overlay-canvas.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Re-IDs every imported element (so it can never collide with an id
   * already in use) and drops anything that isn't at least shaped like a
   * real element — a malformed or hand-edited file shouldn't be able to
   * crash the canvas, just silently lose the elements that don't parse. */
  const importCanvas = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.elements) ? parsed.elements : [];
        const cleaned: CanvasElementT[] = incoming
          .filter(
            (e): e is CanvasElementT =>
              !!e &&
              typeof e === "object" &&
              typeof (e as CanvasElementT).params?.template === "string" &&
              typeof (e as CanvasElementT).xPct === "number"
          )
          .slice(0, 20)
          .map((e, i) => ({ ...e, id: `import-${Date.now()}-${i}` }));
        if (cleaned.length === 0) {
          setError("That file didn't contain any recognizable overlay elements");
          return;
        }
        recordBeforeChange(elements);
        setElements(cleaned);
        setSelectedId(cleaned[0]!.id);
        setError("");
      } catch (e) {
        setError(`Couldn't read that file as a canvas export: ${e}`);
      }
    };
    reader.readAsText(file);
  };

  /** Drag-to-reorder in the Layers panel — reassigns every element's
   * z-index from the new top-to-bottom order (top of the list = highest
   * z-index = front-most), same visual convention as Canva/Photoshop
   * layers. */
  const reorderLayers = (draggedId: string | null, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    const fromIdx = sorted.findIndex((e) => e.id === draggedId);
    const toIdx = sorted.findIndex((e) => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);
    const total = reordered.length;
    const zByI = new Map(reordered.map((el, i) => [el.id, total - 1 - i]));
    recordBeforeChange(elements);
    setElements((prev) => prev.map((e) => ({ ...e, zIndex: zByI.get(e.id) ?? e.zIndex })));
    setDraggingLayerId(null);
  };

  // Same ambiguity as OverlayMaker's single-widget save: editing a
  // pre-existing canvas could mean "update it" or "keep the original, make
  // a variant" — worth asking rather than guessing. A brand-new canvas has
  // nothing to be ambiguous about and saves immediately.
  const save = () => {
    if (elements.length === 0) {
      setError("Add at least one element first");
      return;
    }
    if (mode === "edit" && editFile) {
      setShowSaveChoice(true);
      return;
    }
    void doSave("create");
  };

  const doSave = async (which: "update" | "create") => {
    setShowSaveChoice(false);
    setSaving(true);
    try {
      if (which === "update" && editFile) {
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bd-black)" }}>
      <div className="px-5 py-3 shrink-0 border-b border-white/[0.06]">
        <SectionHead
          icon="🧩"
          title={mode === "edit" ? "Edit Canvas Overlay" : "Build a Canvas Overlay"}
          desc="Multiple widgets, placed and stacked freely, in one overlay"
          right={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={undo} disabled={past.length === 0}>
                ↶ Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={future.length === 0}>
                ↷ Redo
              </Button>
              <Button variant="ghost" size="sm" onClick={requestClose}>
                ✕ Close
              </Button>
            </div>
          }
        />
      </div>

      {error && (
        <Card padding={10} className="mx-5 mt-3 shrink-0">
          <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
            {error}
          </p>
        </Card>
      )}

      {/* Below xl, panels stack top-to-bottom in one scroll column instead of
          side-by-side — keeps this usable docked to half of a portrait
          monitor, not just a wide landscape window. */}
      <div className="flex-1 overflow-y-auto xl:overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:h-full gap-4 p-5">
          {/* Layers — top of the list is front-most (highest z-index), same
              convention as Canva/Photoshop. Drag a row to restack it. */}
          <Card padding={14} className="xl:w-[220px] shrink-0 xl:overflow-y-auto space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block">Layers</label>
            <div className="space-y-1">
              {[...elements]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((el) => {
                  const { icon, label } = elementIconLabel(el);
                  const isPicked = multiSelected.size > 0 ? multiSelected.has(el.id) : selectedId === el.id;
                  return (
                    <div
                      key={el.id}
                      draggable
                      onDragStart={() => setDraggingLayerId(el.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => reorderLayers(draggingLayerId, el.id)}
                      onClick={(ev) => {
                        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
                          toggleMultiSelect(el.id);
                        } else {
                          setSelectedId(el.id);
                          setMultiSelected(new Set());
                        }
                      }}
                      title="Click to select, Ctrl/Shift-click to multi-select for grouping"
                      className={`w-full text-left flex items-center gap-1.5 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                        isPicked
                          ? "bg-purple-500/15 border-purple-500/40"
                          : "bg-white/[0.02] border-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      <span className="text-white/15 text-[10px] leading-none">⋮⋮</span>
                      <span className="text-[13px]">{icon}</span>
                      <span className="text-[11px] text-white/70 flex-1 truncate">{label}</span>
                      {el.groupId && (
                        <Tooltip label="Grouped — moves together with linked elements">
                          <span className="text-[10px] text-purple-300/70">🔗</span>
                        </Tooltip>
                      )}
                      <Tooltip label={el.locked ? "Unlock (allow drag/resize)" : "Lock (prevent drag/resize)"}>
                        <span
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleLock(el.id);
                          }}
                          className={`text-[10px] px-1 ${el.locked ? "text-amber-300/80" : "text-white/20 hover:text-white/50"}`}
                        >
                          {el.locked ? "🔒" : "🔓"}
                        </span>
                      </Tooltip>
                      <span
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removeElement(el.id);
                        }}
                        className="text-[10px] text-white/20 hover:text-red-400 px-1"
                      >
                        ✕
                      </span>
                    </div>
                  );
                })}
            </div>

            {effectiveSelection.size >= 2 && (
              <Button variant="ghost" size="sm" onClick={groupSelected} className="w-full">
                🔗 Group Selected
              </Button>
            )}
            {elements.some((e) => effectiveSelection.has(e.id) && e.groupId) && (
              <Button variant="ghost" size="sm" onClick={ungroupSelected} className="w-full">
                Ungroup
              </Button>
            )}

            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={exportCanvas} disabled={elements.length === 0} className="flex-1">
                ⬇ Export
              </Button>
              <Button variant="ghost" size="sm" onClick={() => importInputRef.current?.click()} className="flex-1">
                ⬆ Import
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importCanvas(file);
                  e.target.value = "";
                }}
              />
            </div>

            {showTemplatePicker ? (
              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/30 uppercase tracking-wide block px-0.5">Shapes & Text</label>
                  <div className="grid grid-cols-2 gap-1">
                    {PRIMITIVES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addPrimitive(p.id)}
                        className="text-left px-2.5 py-1.5 rounded-lg text-[11px] text-white/60 bg-white/[0.02] border border-white/[0.06] hover:border-white/15"
                      >
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/30 uppercase tracking-wide block px-0.5">Widgets</label>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addElement(t.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-white/60 bg-white/[0.02] border border-white/[0.06] hover:border-white/15"
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowTemplatePicker(false)} className="w-full text-[10px] text-white/25 pt-1">
                  Cancel
                </button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowTemplatePicker(true)} className="w-full">
                + Add Element
              </Button>
            )}

            {showAiPanel ? (
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. cozy pastel countdown with a webcam frame and follower goal"
                  rows={3}
                  className="w-full input-glass text-[11px] resize-none"
                />
                {aiError && <p className="text-[10px]" style={{ color: "var(--bd-red-text)" }}>{aiError}</p>}
                <div className="flex gap-1.5">
                  <Button variant="cta" size="sm" onClick={generateWithAi} disabled={aiBusy || !aiPrompt.trim()} className="flex-1">
                    {aiBusy ? "Designing…" : "Generate"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-[9px] text-white/20">
                  Replaces the whole canvas — undoable (Ctrl+Z) if you don't like it. Uses your Hugging Face
                  connection from Connections & Keys.
                </p>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(true)} className="w-full">
                ✨ Design with AI
              </Button>
            )}
          </Card>

          {/* Selected element's fields */}
          <Card padding={16} className="xl:w-[340px] shrink-0 xl:overflow-y-auto">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Align to Canvas</label>
                  <div className="flex gap-1">
                    {([
                      ["left", "⇤"],
                      ["centerH", "↔"],
                      ["right", "⇥"],
                      ["top", "⇧"],
                      ["centerV", "↕"],
                      ["bottom", "⇩"],
                    ] as [AlignTo, string][]).map(([align, icon]) => (
                      <button
                        key={align}
                        onClick={() => alignSelected(align)}
                        className="flex-1 py-1.5 rounded-lg text-[12px] bg-white/[0.03] border border-white/[0.06] text-white/60 hover:border-white/20 hover:text-white/90"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="X (%)" value={selected.xPct} min={0} max={100} onChange={(v) => setSelectedPlacement({ xPct: v })} />
                  <NumberField label="Y (%)" value={selected.yPct} min={0} max={100} onChange={(v) => setSelectedPlacement({ yPct: v })} />
                  <NumberField label="Width (%)" value={selected.widthPct} min={2} max={100} onChange={(v) => setSelectedPlacement({ widthPct: v })} />
                  <NumberField label="Height (%)" value={selected.heightPct} min={2} max={100} onChange={(v) => setSelectedPlacement({ heightPct: v })} />
                  <NumberField label="Rotation (°)" value={selected.rotation ?? 0} min={-360} max={360} onChange={(v) => setSelectedPlacement({ rotation: v })} />
                  <div className="col-span-2 grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                    <NumberField label="Layer" value={selected.zIndex} min={0} max={99} onChange={(v) => setSelectedPlacement({ zIndex: v })} />
                    <Button variant="ghost" size="sm" onClick={() => bringToFront(selected.id)}>
                      Front
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => sendToBack(selected.id)}>
                      Back
                    </Button>
                  </div>
                </div>
                {elementKind(selected) === "template" ? (
                  <TemplateFieldsEditor
                    params={selected.params}
                    set={setSelectedParam}
                    liveSources={liveSources}
                    showTemplatePicker={false}
                  />
                ) : (
                  <PrimitiveFieldsEditor
                    kind={elementKind(selected)}
                    params={selected.primitive ?? DEFAULT_PRIMITIVE_PARAMS}
                    set={setSelectedPrimitive}
                  />
                )}
              </div>
            ) : (
              <p className="text-[11px] text-white/25 pt-2">
                {elements.length === 0 ? "Add an element to get started." : "Select an element to edit it."}
              </p>
            )}
          </Card>

          {/* Canvas — drag an element to move it, drag its bottom-right handle
              to resize, both snapping to the canvas center/edges and other
              elements' edges (thin purple guide lines while snapped). */}
          <Card padding={16} className="flex-1 min-w-0 space-y-2">
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
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{ width: NATIVE_W, height: NATIVE_H, transform: `scale(${canvasScale})`, transformOrigin: "top left", border: 0 }}
                />
              )}

              {elements.map((el) => {
                const { icon, label } = elementIconLabel(el);
                const isSelected = multiSelected.size > 0 ? multiSelected.has(el.id) : el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => startDrag(e, el, "move")}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(el.id);
                      setMultiSelected(new Set());
                      setContextMenu({ x: e.clientX, y: e.clientY, elId: el.id });
                    }}
                    className={`absolute border-2 rounded ${el.locked ? "cursor-not-allowed" : "cursor-move"} ${
                      isSelected ? "border-purple-400" : el.groupId ? "border-purple-400/30" : "border-white/15 hover:border-white/35"
                    }`}
                    style={{
                      left: `${el.xPct}%`,
                      top: `${el.yPct}%`,
                      width: `${el.widthPct}%`,
                      height: `${el.heightPct}%`,
                      zIndex: el.zIndex + 1,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      transformOrigin: "center center",
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[9px] text-white/50 whitespace-nowrap">
                      {el.locked && "🔒 "}
                      {icon} {label}
                    </span>
                    {!el.locked && (
                      <>
                        <div
                          onMouseDown={(e) => startDrag(e, el, "resize")}
                          className={`absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm cursor-nwse-resize ${
                            isSelected ? "bg-purple-400" : "bg-white/30"
                          }`}
                        />
                        {isSelected && (
                          <Tooltip label="Drag to rotate">
                            <div
                              onMouseDown={(e) => startRotate(e, el)}
                              className="absolute -top-6 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400 cursor-grab active:cursor-grabbing border border-white/40"
                            />
                          </Tooltip>
                        )}
                      </>
                    )}
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
            <p className="text-[10px] text-white/20">
              With an element selected: arrow keys nudge (Shift for bigger steps), Ctrl+D duplicates, Delete
              removes, right-click for more. Ctrl+Z / Ctrl+Shift+Z undo/redo anywhere.
            </p>
          </Card>
        </div>

        {mode === "edit" && editFile && (
          <div className="px-5 pb-5">
            <VersionHistoryPanel file={editFile} onRestored={onSaved} />
          </div>
        )}
      </div>

      {contextMenu && (
          <div
            className="fixed z-[60] bg-black/95 border border-white/10 rounded-lg shadow-xl py-1 text-[11px] min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                duplicateSelected();
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/10"
            >
              ⎘ Duplicate
            </button>
            <button
              onClick={() => {
                bringToFront(contextMenu.elId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/10"
            >
              ⬆ Bring to Front
            </button>
            <button
              onClick={() => {
                sendToBack(contextMenu.elId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/10"
            >
              ⬇ Send to Back
            </button>
            <button
              onClick={() => {
                removeElement(contextMenu.elId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-red-300 hover:bg-red-500/20"
            >
              ✕ Delete
            </button>
          </div>
        )}

      <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.06] shrink-0">
        <Button variant="ghost" onClick={requestClose}>
          Cancel
        </Button>
        <Button variant="cta" onClick={save} disabled={saving}>
          {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Overlay"}
        </Button>
      </div>

      {showSaveChoice && (
        <SaveChoiceDialog
          onUpdate={() => void doSave("update")}
          onSaveAsNew={() => void doSave("create")}
          onCancel={() => setShowSaveChoice(false)}
        />
      )}

      {showUnsavedConfirm && (
        <UnsavedChangesDialog onDiscard={onClose} onCancel={() => setShowUnsavedConfirm(false)} />
      )}
    </div>
  );
}
