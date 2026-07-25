import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_TEMPLATE_PARAMS, type TemplateParams } from "../overlay-library/types";
import { useLiveSources } from "../overlay-library/useLiveSources";
import TemplateFieldsEditor from "./TemplateFieldsEditor";
import { Button, Card, SectionHead } from "../../design-system/components/core";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveSources = useLiveSources();

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

  const save = async () => {
    setSaving(true);
    try {
      // "edit" targets editFile exactly — it can only ever overwrite the
      // overlay it was opened from. Every other path (new overlay, or a
      // "Duplicate" that pre-fills initialParams but keeps mode "create")
      // asks the backend for a fresh, guaranteed-unique file name instead,
      // so it's structurally impossible for this Save to touch any overlay
      // other than the one it's explicitly targeting.
      if (mode === "edit" && editFile) {
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <Card padding={24} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <SectionHead
            icon={icon}
            title={title}
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

        <div className="grid grid-cols-2 gap-6">
          <TemplateFieldsEditor params={params} set={set} liveSources={liveSources} />

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
