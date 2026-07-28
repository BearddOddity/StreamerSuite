import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useOverlays } from "./useOverlays";
import { openAppInNewWindow } from "../../shell/popout";
import { DeleteConfirmDialog } from "../overlay-editor/ConfirmDialogs";
import "../../design-system/styles.css";
import { Button, Card, SectionHead, Badge } from "../../design-system/components/core";
import { Tooltip } from "../../design-system/components/overlay";

function OverlayPreview({ url }: { url: string }) {
  return (
    <div className="w-24 h-14 shrink-0 rounded-lg overflow-hidden border border-white/[0.06] bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:12px_12px]">
      <iframe title={url} src={url} className="w-[400%] h-[400%] scale-[0.25] origin-top-left pointer-events-none" />
    </div>
  );
}

// Opens the Overlay Editor app (in its own window) with this overlay
// pre-loaded — Library is purely for browsing/renaming/deleting; actually
// editing structure/fields always happens in the Editor, never here.
function editInEditor(file: string, kind: "template" | "canvas", mode: "edit" | "create") {
  openAppInNewWindow("overlay-editor", "Overlay Editor", { editFile: file, kind, mode }, { width: 1100, height: 760 });
}

export default function OverlayLibraryApp() {
  const { builtin, custom, error, copied, builtinUrl, customUrl, copyUrl, addCustom, removeCustom, refresh, sendTestAlert } = useOverlays();
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<{ file: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ file: string; name: string } | null>(null);
  const [renameError, setRenameError] = useState("");

  const visibleCustom = custom.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  // A rename only ever touches a small display-name override, never the
  // overlay's actual filename — so it can't break a Browser Source URL
  // already pasted into OBS, which is derived from the filename. Works for
  // any custom overlay, not just Maker-built ones — a plain upload can be
  // given a friendlier name too.
  const commitRename = async () => {
    if (!renaming) return;
    const { file, value } = renaming;
    setRenaming(null);
    try {
      await invoke("overlay_rename_custom", { file, name: value });
      await refresh();
    } catch (e) {
      setRenameError(String(e));
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <SectionHead
            icon="🖼️"
            title="Overlay Library"
            desc="Browse, rename, and copy the URL for every overlay. Build or edit one in the Editor app (🧩)."
          />
        </div>

        {(error || renameError) && (
          <Card padding={12} className="mb-4">
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
              {error || renameError}
            </p>
          </Card>
        )}

        <Card padding={20} className="mb-4">
          <h3 className="text-[13px] font-semibold text-white/80 mb-3">Built-in</h3>
          {builtin.length === 0 ? (
            <p className="text-[11px] text-white/25">No built-in overlays found.</p>
          ) : (
            <div className="space-y-2">
              {builtin.map((o) => (
                <div key={o.file} className="flex items-center gap-3 bg-white/[0.02] rounded-lg px-3 py-2">
                  <OverlayPreview url={builtinUrl(o.file)} />
                  <span className="text-[12px] text-white/70 flex-1 capitalize">{o.name}</span>
                  {o.file === "alerts-overlay.html" && (
                    <Button variant="ghost" size="sm" onClick={sendTestAlert}>
                      Send Test Alert
                    </Button>
                  )}
                  <Button variant={copied === o.file ? "success" : "primary"} size="sm" onClick={() => copyUrl(builtinUrl(o.file), o.file)}>
                    {copied === o.file ? "Copied ✓" : "Copy URL"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding={20}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-[13px] font-semibold text-white/80">Custom</h3>
            <div className="flex items-center gap-2">
              {custom.length > 0 && (
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="input-glass text-[11px] w-36 py-1"
                />
              )}
              <Button variant="ghost" size="sm" onClick={addCustom}>
                + Add Overlay
              </Button>
            </div>
          </div>
          {custom.length === 0 ? (
            <p className="text-[11px] text-white/25">
              Add your own HTML/image/text file, or build one with the editor app (🧩).
            </p>
          ) : visibleCustom.length === 0 ? (
            <p className="text-[11px] text-white/25">No overlays match "{search}".</p>
          ) : (
            <div className="space-y-2">
              {visibleCustom.map((o) => (
                <div key={o.file} className="flex items-center gap-3 bg-white/[0.02] rounded-lg px-3 py-2">
                  <OverlayPreview url={customUrl(o.file)} />

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
                    <Tooltip label="Double-click to rename" className="flex-1 min-w-0">
                      <span
                        onDoubleClick={() => setRenaming({ file: o.file, value: o.name })}
                        className="text-[12px] text-white/70 capitalize cursor-text truncate block"
                      >
                        {o.name}
                      </span>
                    </Tooltip>
                  )}

                  {o.editable && <Badge variant="purple">{o.kind === "canvas" ? "Canvas" : "Widget"}</Badge>}

                  <Tooltip label="Rename">
                    <button
                      onClick={() => setRenaming({ file: o.file, value: o.name })}
                      className="text-[11px] text-white/25 hover:text-white/60 px-1"
                    >
                      🏷️
                    </button>
                  </Tooltip>

                  {o.editable && o.kind && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => editInEditor(o.file, o.kind!, "edit")}>
                        ✏️ Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => editInEditor(o.file, o.kind!, "create")}>
                        ⎘ Duplicate
                      </Button>
                    </>
                  )}

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
