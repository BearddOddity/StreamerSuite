// Overlay Editor — where overlays actually get built and edited. Browsing,
// renaming, and deleting every overlay (built-in or custom, editable or
// not) lives in the separate Overlay Library app instead; Library's own
// Edit/Duplicate buttons redirect here (via a popout window carrying
// ?editFile=&kind=&mode= — see openAppInNewWindow) rather than duplicating
// that list here too.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import OverlayMaker from "./OverlayMaker";
import CanvasMaker from "./CanvasMaker";
import type { CanvasElementT, TemplateParams } from "../overlay-library/types";
import "../../design-system/styles.css";
import { Button, Card, SectionHead } from "../../design-system/components/core";

type MakerState = { mode: "create" | "edit"; editFile?: string; initialParams?: TemplateParams };
type CanvasMakerState = {
  mode: "create" | "edit";
  editFile?: string;
  initialElements?: CanvasElementT[];
  initialWidth?: number;
  initialHeight?: number;
};

export default function OverlayEditorApp() {
  const [maker, setMaker] = useState<MakerState | null>(null);
  const [canvasMaker, setCanvasMaker] = useState<CanvasMakerState | null>(null);
  const [loadError, setLoadError] = useState("");

  // Loads a Maker-built overlay's own saved settings before opening it —
  // each overlay's settings live only in its own sidecar file, so this
  // always loads exactly the one overlay being edited/duplicated, never
  // anything shared across overlays. `kind` decides which editor/command
  // pair (single-widget vs multi-widget canvas) to use.
  const openWithSavedParams = async (file: string, mode: "create" | "edit", kind: "template" | "canvas") => {
    try {
      if (kind === "canvas") {
        const canvasParams = await invoke<{ elements: CanvasElementT[]; width?: number; height?: number } | null>("overlay_get_canvas_params", { file });
        if (!canvasParams) return;
        setLoadError("");
        const shared = { initialElements: canvasParams.elements, initialWidth: canvasParams.width, initialHeight: canvasParams.height };
        setCanvasMaker(mode === "edit" ? { mode: "edit", editFile: file, ...shared } : { mode: "create", ...shared });
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

  // Overlay Library redirects here with ?editFile=<file>&kind=<template|canvas>&mode=<edit|create>
  // (Duplicate uses mode=create with the source file's kind/params, same as
  // the in-app Duplicate button used to) — picked up once on mount so a
  // launch from Library drops straight into the right Maker instead of
  // landing on an empty "New Widget/New Canvas" screen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editFile = params.get("editFile");
    const kind = params.get("kind");
    const mode = params.get("mode");
    if (editFile && (kind === "template" || kind === "canvas") && (mode === "edit" || mode === "create")) {
      void openWithSavedParams(editFile, mode, kind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <SectionHead
            icon="🧩"
            title="Overlay Editor"
            desc="Build a new overlay — single widgets or multi-widget canvases. Browse, rename, or delete existing ones from the Overlay Library app (🖼️)."
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

        {loadError && (
          <Card padding={12}>
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
              {loadError}
            </p>
          </Card>
        )}
      </div>

      {maker && (
        <OverlayMaker
          mode={maker.mode}
          editFile={maker.editFile}
          initialParams={maker.initialParams}
          onClose={() => setMaker(null)}
          onSaved={() => setMaker(null)}
        />
      )}

      {canvasMaker && (
        <CanvasMaker
          mode={canvasMaker.mode}
          editFile={canvasMaker.editFile}
          initialElements={canvasMaker.initialElements}
          initialWidth={canvasMaker.initialWidth}
          initialHeight={canvasMaker.initialHeight}
          onClose={() => setCanvasMaker(null)}
          onSaved={() => setCanvasMaker(null)}
        />
      )}
    </div>
  );
}
