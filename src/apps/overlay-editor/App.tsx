// Overlay Editor — where overlays actually get built and edited (Overlay
// Library, a separate app, is purely for browsing/copying URLs of every
// overlay, built-in or custom, editable or not). Split out once this grew
// past "a couple of buttons in a list screen" into a real direct-
// manipulation editor (drag/resize/snap canvas, per-widget field editor).
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useOverlays } from "../overlay-library/useOverlays";
import OverlayMaker from "./OverlayMaker";
import CanvasMaker from "./CanvasMaker";
import { DeleteConfirmDialog } from "./ConfirmDialogs";
import type { CanvasElementT, TemplateParams } from "../overlay-library/types";
import "../../design-system/styles.css";
import { Button, Card, SectionHead, Badge } from "../../design-system/components/core";

type MakerState = { mode: "create" | "edit"; editFile?: string; initialParams?: TemplateParams };
type CanvasMakerState = { mode: "create" | "edit"; editFile?: string; initialElements?: CanvasElementT[] };

export default function OverlayEditorApp() {
  const { custom, error, copied, customUrl, copyUrl, removeCustom, refresh } = useOverlays();
  const [maker, setMaker] = useState<MakerState | null>(null);
  const [canvasMaker, setCanvasMaker] = useState<CanvasMakerState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ file: string; name: string } | null>(null);
  const [renaming, setRenaming] = useState<{ file: string; value: string } | null>(null);
  const [search, setSearch] = useState("");

  const editable = custom.filter((o) => o.editable && o.kind);
  const visible = editable.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  // A rename only ever touches a small display-name override, never the
  // overlay's actual filename — so it can't break a Browser Source URL
  // already pasted into OBS, which is derived from the filename.
  const commitRename = async () => {
    if (!renaming) return;
    const { file, value } = renaming;
    setRenaming(null);
    try {
      await invoke("overlay_rename_custom", { file, name: value });
      await refresh();
    } catch (e) {
      setLoadError(String(e));
    }
  };

  // Loads a Maker-built overlay's own saved settings before opening it —
  // each overlay's settings live only in its own sidecar file, so this
  // always loads exactly the one overlay being edited/duplicated, never
  // anything shared across overlays. `kind` decides which editor/command
  // pair (single-widget vs multi-widget canvas) to use.
  const openWithSavedParams = async (file: string, mode: "create" | "edit", kind: "template" | "canvas") => {
    try {
      if (kind === "canvas") {
        const canvasParams = await invoke<{ elements: CanvasElementT[] } | null>("overlay_get_canvas_params", { file });
        if (!canvasParams) return;
        setLoadError("");
        setCanvasMaker(
          mode === "edit"
            ? { mode: "edit", editFile: file, initialElements: canvasParams.elements }
            : { mode: "create", initialElements: canvasParams.elements }
        );
        return;
      }
      const params = await invoke<TemplateParams | null>("overlay_get_template_params", { file });
      if (!params) return;
      setLoadError("");
      setMaker(mode === "edit" ? { mode: "edit", editFile: file, initialParams: params } : { mode: "create", initialParams: params });
    } catch (e) {
      setLoadError(String(e));
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <SectionHead
            icon="🧩"
            title="Overlay Editor"
            desc="Build and edit overlays — single widgets or multi-widget canvases"
            right={
              <div className="flex gap-2">
                <Button variant="cta" size="sm" onClick={() => setMaker({ mode: "create" })}>
                  🎨 New Widget
                </Button>
                <Button variant="cta" size="sm" onClick={() => setCanvasMaker({ mode: "create" })}>
                  🧩 New Canvas
                </Button>
              </div>
            }
          />
        </div>

        {(error || loadError) && (
          <Card padding={12} className="mb-4">
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
              {error || loadError}
            </p>
          </Card>
        )}

        <Card padding={20}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-[13px] font-semibold text-white/80">Your Overlays</h3>
            {editable.length > 0 && (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="input-glass text-[11px] w-40 py-1"
              />
            )}
          </div>
          {editable.length === 0 ? (
            <p className="text-[11px] text-white/25">
              Nothing built yet — start with "New Widget" for a single element, or "New Canvas" for several
              placed together. Plain uploaded files (not built here) show up in the Overlay Library app instead.
            </p>
          ) : visible.length === 0 ? (
            <p className="text-[11px] text-white/25">No overlays match "{search}".</p>
          ) : (
            <div className="space-y-2">
              {visible.map((o) => (
                <div key={o.file} className="flex items-center gap-3 bg-white/[0.02] rounded-xl px-3 py-2">
                  {renaming?.file === o.file ? (
                    <input
                      autoFocus
                      value={renaming.value}
                      onChange={(e) => setRenaming({ file: o.file, value: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="input-glass text-[12px] flex-1"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => setRenaming({ file: o.file, value: o.name })}
                      title="Double-click to rename"
                      className="text-[12px] text-white/70 flex-1 capitalize cursor-text"
                    >
                      {o.name}
                    </span>
                  )}
                  <Badge variant="purple">{o.kind === "canvas" ? "Canvas" : "Widget"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setRenaming({ file: o.file, value: o.name })}>
                    🏷️ Rename
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openWithSavedParams(o.file, "edit", o.kind!)}>
                    ✏️ Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openWithSavedParams(o.file, "create", o.kind!)}>
                    ⎘ Duplicate
                  </Button>
                  <Button variant={copied === o.file ? "success" : "primary"} size="sm" onClick={() => copyUrl(customUrl(o.file), o.file)}>
                    {copied === o.file ? "Copied ✓" : "Copy URL"}
                  </Button>
                  <button
                    onClick={() => setDeleteTarget({ file: o.file, name: o.name })}
                    className="text-[11px] text-white/25 hover:text-red-400 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {maker && (
        <OverlayMaker
          mode={maker.mode}
          editFile={maker.editFile}
          initialParams={maker.initialParams}
          onClose={() => setMaker(null)}
          onSaved={() => {
            setMaker(null);
            refresh();
          }}
        />
      )}

      {canvasMaker && (
        <CanvasMaker
          mode={canvasMaker.mode}
          editFile={canvasMaker.editFile}
          initialElements={canvasMaker.initialElements}
          onClose={() => setCanvasMaker(null)}
          onSaved={() => {
            setCanvasMaker(null);
            refresh();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          name={deleteTarget.name}
          onConfirm={() => {
            removeCustom(deleteTarget.file);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
