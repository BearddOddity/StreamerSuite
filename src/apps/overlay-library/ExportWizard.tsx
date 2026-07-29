// Multi-step "Export Standalone" wizard — turns a custom overlay into a
// self-contained folder a recipient without StreamerSuite can run on their
// own machine, per Documentation/09-portable-overlay-export.md. Detection
// and file-writing both happen on the Rust side (overlay_export_detect_requirements
// / overlay_export_standalone); this component is just the guided review +
// options screen in front of those two commands.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { humanizeSourceKey, KNOWN_LIVE_SOURCES } from "./types";

interface ExportRequirements {
  liveSources: string[];
  alertKinds: string[];
  usesStatusForge: boolean;
}

interface ExportOptions {
  includeTwitch: boolean;
  includeKick: boolean;
  includeYoutube: boolean;
  includeChaturbate: boolean;
  includeStreamerbot: boolean;
  customizeColor: boolean;
  customizeFont: boolean;
  customizeText: boolean;
  port: number;
}

function labelForSource(source: string): string {
  const known = KNOWN_LIVE_SOURCES.find((s) => s.value === source);
  return known ? known.label : humanizeSourceKey(source);
}

export function ExportWizard({
  file,
  kind,
  name,
  onClose,
}: {
  file: string;
  kind: "template" | "canvas";
  name: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"detecting" | "blocked" | "options" | "exporting" | "done" | "error">("detecting");
  const [requirements, setRequirements] = useState<ExportRequirements | null>(null);
  const [error, setError] = useState("");
  const [outDir, setOutDir] = useState("");
  const [options, setOptions] = useState<ExportOptions>({
    includeTwitch: true,
    includeKick: false,
    includeYoutube: false,
    includeChaturbate: false,
    includeStreamerbot: false,
    customizeColor: true,
    customizeFont: true,
    customizeText: true,
    port: 8420,
  });

  useEffect(() => {
    let cancelled = false;
    invoke<ExportRequirements>("overlay_export_detect_requirements", { file, kind })
      .then((req) => {
        if (cancelled) return;
        setRequirements(req);
        setStep(req.usesStatusForge ? "blocked" : "options");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setStep("error");
      });
    return () => {
      cancelled = true;
    };
  }, [file, kind]);

  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));

  const runExport = async () => {
    const target = await open({ directory: true });
    if (!target || Array.isArray(target)) return;
    setStep("exporting");
    try {
      const dir = await invoke<string>("overlay_export_standalone", {
        file,
        kind,
        targetDir: target,
        options,
      });
      setOutDir(dir);
      setStep("done");
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-float-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative w-[480px] bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-float-card-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📦</span>
          <h3 className="text-white font-semibold text-sm">Export "{name}" Standalone</h3>
        </div>

        {step === "detecting" && <p className="text-[12px] text-white/50">Checking what this overlay needs…</p>}

        {step === "blocked" && (
          <>
            <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
              This overlay uses a StatusForge-driven field (Now Playing / Game Logo), which has no portable
              equivalent yet — it can't be exported standalone. Rebuild it without those templates, or export a
              different overlay.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="btn-ghost text-[11px] px-3 py-1.5">
                Close
              </button>
            </div>
          </>
        )}

        {step === "options" && requirements && (
          <>
            <div className="mb-4 space-y-2">
              <p className="text-[11px] text-white/40 uppercase tracking-wide">Detected requirements</p>
              {requirements.liveSources.length === 0 && requirements.alertKinds.length === 0 ? (
                <p className="text-[11px] text-white/50">No live data or alerts — this overlay is fully static.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {requirements.liveSources.map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60">
                      {labelForSource(s)}
                    </span>
                  ))}
                  {requirements.alertKinds.map((k) => (
                    <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200">
                      Alert: {k === "any" ? "Any kind" : k}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-[11px] text-white/40 uppercase tracking-wide">Platforms the recipient can connect</p>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.includeTwitch} onChange={(e) => set("includeTwitch", e.target.checked)} />
                Twitch (own token + Client ID — viewers/followers/subs, real follow alerts)
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.includeKick} onChange={(e) => set("includeKick", e.target.checked)} />
                Kick (own token + channel slug — live viewer count/status only, no alerts)
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.includeYoutube} onChange={(e) => set("includeYoutube", e.target.checked)} />
                YouTube (own Data API key + channel ID — viewer count, Super Chat/membership alerts, only while live)
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.includeChaturbate} onChange={(e) => set("includeChaturbate", e.target.checked)} />
                Chaturbate (own username + Events API token — real tip/follow alerts)
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.includeStreamerbot} onChange={(e) => set("includeStreamerbot", e.target.checked)} />
                Streamer.bot (relays latest chat message from a Streamer.bot already running on the recipient's machine — including YouTube chat)
              </label>
              <p className="text-[10px] text-white/25 pt-1">
                Joystick.tv isn't supported yet — its live data needs an OAuth login flow this export can't do standalone.
              </p>
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-[11px] text-white/40 uppercase tracking-wide">Let the recipient customize</p>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.customizeColor} onChange={(e) => set("customizeColor", e.target.checked)} />
                Colors
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.customizeFont} onChange={(e) => set("customizeFont", e.target.checked)} />
                Font
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                <input type="checkbox" checked={options.customizeText} onChange={(e) => set("customizeText", e.target.checked)} />
                Text content
              </label>
            </div>

            <div className="mb-5 flex items-center gap-2">
              <label className="text-[11px] text-white/40 uppercase tracking-wide shrink-0">Helper port</label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={options.port}
                onChange={(e) => set("port", Number(e.target.value) || 8420)}
                className="input-glass text-[11px] w-24"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn-ghost text-[11px] px-3 py-1.5">
                Cancel
              </button>
              <button onClick={runExport} className="btn-cta text-[11px] px-3 py-1.5">
                📦 Choose Folder & Export
              </button>
            </div>
          </>
        )}

        {step === "exporting" && <p className="text-[12px] text-white/50">Exporting…</p>}

        {step === "done" && (
          <>
            <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
              Exported to <span className="text-white/80 break-all">{outDir}</span>. Hand the whole folder to the
              recipient — they open <span className="text-white/80">README.txt</span> to get started.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="btn-cta text-[11px] px-3 py-1.5">
                Done
              </button>
            </div>
          </>
        )}

        {step === "error" && (
          <>
            <p className="text-[12px] mb-5 leading-relaxed" style={{ color: "var(--bd-red-text)" }}>
              {error}
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="btn-ghost text-[11px] px-3 py-1.5">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
