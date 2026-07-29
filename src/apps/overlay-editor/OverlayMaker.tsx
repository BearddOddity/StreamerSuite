import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_TEMPLATE_PARAMS, type TemplateParams } from "../overlay-library/types";
import { useLiveSources } from "../overlay-library/useLiveSources";
import TemplateFieldsEditor from "./TemplateFieldsEditor";
import ScaledPreview from "./ScaledPreview";
import { SaveChoiceDialog, UnsavedChangesDialog } from "./ConfirmDialogs";
import VersionHistoryPanel from "./VersionHistoryPanel";
import { Button, Card, SectionHead, CopyButton } from "../../design-system/components/core";

export default function OverlayMaker({
  onSaved,
  onClose,
  mode = "create",
  editFile,
  initialParams,
}: {
  onSaved: () => void;
  onClose: () => void;
  /** "edit" overwrites editFile in place; "create" always writes a new, uniquely-named
   *  file — used both for a from-scratch overlay and for "Duplicate" (same initialParams,
   *  no editFile), so a duplicate can never collide with or modify the overlay it came from. */
  mode?: "create" | "edit";
  editFile?: string;
  initialParams?: TemplateParams;
}) {
  const [params, setParams] = useState<TemplateParams>(initialParams ?? DEFAULT_TEMPLATE_PARAMS);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveChoice, setShowSaveChoice] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [past, setPast] = useState<TemplateParams[]>([]);
  const [future, setFuture] = useState<TemplateParams[]>([]);
  // Only needed to build the OBS Browser Source URL for the "Copy URL"
  // button below — same command the Overlay Library's own Copy URL
  // buttons use (useOverlays.ts).
  const [overlayToken, setOverlayToken] = useState("");
  useEffect(() => {
    if (mode !== "edit" || !editFile) return;
    invoke<string>("get_overlay_token")
      .then(setOverlayToken)
      .catch(() => {});
  }, [mode, editFile]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshotRef = useRef(JSON.stringify(initialParams ?? DEFAULT_TEMPLATE_PARAMS));
  const pendingBeforeRef = useRef<TemplateParams | null>(null);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveSources = useLiveSources();
  const isDirty = JSON.stringify(params) !== initialSnapshotRef.current;

  const requestClose = () => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  // Same debounced-per-burst history as the Canvas Maker — a run of
  // keystrokes in one text field, or a drag on the opacity slider, becomes
  // one undo step instead of one per individual change event.
  const recordBeforeChange = (before: TemplateParams) => {
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

  const undo = () => {
    if (pendingBeforeRef.current !== null) {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      const target = pendingBeforeRef.current;
      pendingBeforeRef.current = null;
      setFuture((f) => [params, ...f].slice(0, 50));
      setParams(target);
      return;
    }
    if (past.length === 0) return;
    const prevState = past[past.length - 1]!;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [params, ...f].slice(0, 50));
    setParams(prevState);
  };

  const redo = () => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    if (pendingBeforeRef.current !== null) {
      setPast((p) => [...p.slice(-49), pendingBeforeRef.current!]);
      pendingBeforeRef.current = null;
    }
    if (future.length === 0) return;
    const nextState = future[0]!;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, params].slice(-50));
    setParams(nextState);
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [past, future, params]);

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

  const set = <K extends keyof TemplateParams>(key: K, value: TemplateParams[K]) => {
    recordBeforeChange(params);
    setParams((p) => ({ ...p, [key]: value }));
  };

  // Editing a pre-existing overlay is the one ambiguous case — Save could
  // reasonably mean "update it" or "keep the original, make a variant."
  // A brand-new overlay (mode "create" with no editFile) has nothing to be
  // ambiguous about, so it saves immediately with no prompt.
  const save = () => {
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
      // "update" targets editFile exactly — it can only ever overwrite the
      // overlay it was opened from. Every other path (new overlay, a
      // "Duplicate", or "Save as New Variant" from the choice above) asks
      // the backend for a fresh, guaranteed-unique file name instead, so
      // it's structurally impossible for this to touch any overlay other
      // than the one it's explicitly targeting.
      if (which === "update" && editFile) {
        await invoke("overlay_update_template", { file: editFile, params });
      } else {
        await invoke("overlay_create_from_template", { params });
      }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const icon = mode === "edit" ? "✏️" : initialParams ? "⎘" : "🎨";
  const title = mode === "edit" ? "Edit Overlay" : initialParams ? "Duplicate Overlay" : "Build an Overlay";

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bd-black)" }}>
      <div className="px-5 py-3 shrink-0 border-b border-white/[0.06]">
        <SectionHead
          icon={icon}
          title={title}
          right={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={undo} disabled={past.length === 0 && pendingBeforeRef.current === null}>
                ↶ Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={future.length === 0}>
                ↷ Redo
              </Button>
              {mode === "edit" && editFile && overlayToken && (
                <CopyButton
                  value={`http://127.0.0.1:53735/custom-overlay/${encodeURIComponent(overlayToken)}/${encodeURIComponent(editFile)}`}
                  label="Copy URL"
                />
              )}
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

      {/* Below lg, this scrolls as one column (fields, then preview, then
          history) instead of splitting into two independently-scrolling
          panes — keeps everything reachable docked to half of a portrait
          monitor, not just a wide landscape window. */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:h-full gap-4 p-5">
          <div className="lg:w-[420px] shrink-0 lg:overflow-y-auto">
            <Card padding={16}>
              <TemplateFieldsEditor params={params} set={set} liveSources={liveSources} />
            </Card>
          </div>

          <div className="flex-1 lg:overflow-y-auto space-y-4">
            <Card padding={16}>
              <ScaledPreview html={preview} title="overlay-preview" />
            </Card>

            {mode === "edit" && editFile && <VersionHistoryPanel file={editFile} onRestored={onSaved} />}
          </div>
        </div>
      </div>

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
