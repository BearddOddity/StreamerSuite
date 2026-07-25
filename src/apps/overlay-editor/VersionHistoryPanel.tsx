// A collapsible history panel for one already-saved overlay — lets you save
// a named checkpoint of its current on-disk state, and roll back to any
// earlier checkpoint or auto-save. Only meaningful for an overlay that's
// already been saved at least once (there's nothing to snapshot before
// that), so both Makers only render this when editing an existing file.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionInfo } from "../overlay-library/types";
import { Button } from "../../design-system/components/core";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function VersionHistoryPanel({ file, onRestored }: { file: string; onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [labelInput, setLabelInput] = useState("");

  const load = () => {
    invoke<VersionInfo[]>("overlay_list_versions", { file })
      .then(setVersions)
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  const saveCheckpoint = async () => {
    setBusy(true);
    try {
      await invoke("overlay_save_version", { file, label: labelInput });
      setLabelInput("");
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    setBusy(true);
    try {
      await invoke("overlay_restore_version", { file, versionId: id });
      onRestored();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-[11px] text-white/60"
      >
        <span>🕘 Version History</span>
        <span className="text-white/30">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {error && (
            <p className="text-[10px]" style={{ color: "var(--bd-red-text)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Checkpoint name (optional)"
              className="flex-1 min-w-0 input-glass text-[11px]"
            />
            <Button variant="ghost" size="sm" disabled={busy} onClick={saveCheckpoint}>
              💾 Save Checkpoint
            </Button>
          </div>

          {versions.length === 0 ? (
            <p className="text-[10px] text-white/25">
              No saved snapshots yet — one gets auto-saved every time you save changes to this overlay.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-white/70 truncate">{v.label}</div>
                    <div className="text-[9px] text-white/25">{relativeTime(v.timestamp)}</div>
                  </div>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => restore(v.id)}>
                    ↩ Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
