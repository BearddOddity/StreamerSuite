import { useState } from "react";
import { useSoundBoard } from "./useSoundBoard";
import type { SoundPad } from "./types";
import "../../design-system/styles.css";
import { Button, Card, Chip, SectionHead } from "../../design-system/components/core";

export default function SoundBoardApp() {
  const { pads, masterVolume, setMasterVolume, activePad, brokenPads, addPad, removePad, renamePad, setPadHotkey, play, stopAll } =
    useSoundBoard();
  const [editing, setEditing] = useState(false);
  const [capturingHotkeyFor, setCapturingHotkeyFor] = useState<string | null>(null);

  function handleHotkeyCapture(pad: SoundPad, e: React.KeyboardEvent) {
    e.preventDefault();
    if (e.key === "Escape") {
      setCapturingHotkeyFor(null);
      return;
    }
    if (e.key.length === 1) {
      setPadHotkey(pad.id, e.key.toUpperCase());
    }
    setCapturingHotkeyFor(null);
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <SectionHead
            icon="🎛️"
            title="Sound Board"
            desc="Trigger sound effects during your stream"
            right={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/25">🔊</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                    className="w-20 h-1 accent-[var(--accent-system)] bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-system)]"
                  />
                  <span className="text-[10px] text-white/30 font-mono w-7">{masterVolume}%</span>
                </div>
                <Button variant="ghost" size="sm" onClick={stopAll}>
                  ⏹ Stop
                </Button>
                <Chip selected={editing} onClick={() => setEditing((v) => !v)}>
                  {editing ? "Done" : "Edit"}
                </Chip>
              </div>
            }
          />
        </div>

        {/* Sound pads grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {pads.map((pad) => (
            <div key={pad.id} className="relative">
              <button
                onClick={() => (editing ? undefined : play(pad))}
                className={`relative w-full p-5 rounded-2xl border text-center transition-all ${pad.color} ${
                  activePad === pad.id ? "scale-95 brightness-125" : "hover:-translate-y-0.5 hover:shadow-lg"
                } ${brokenPads.has(pad.id) ? "opacity-40" : ""}`}
              >
                <span
                  tabIndex={editing ? 0 : -1}
                  onClick={(e) => {
                    if (!editing) return;
                    e.stopPropagation();
                    setCapturingHotkeyFor(pad.id);
                  }}
                  onKeyDown={(e) => capturingHotkeyFor === pad.id && handleHotkeyCapture(pad, e)}
                  className={`absolute top-1.5 right-2 text-[9px] font-mono px-1 rounded ${
                    capturingHotkeyFor === pad.id ? "bg-purple-500/40 text-white" : "text-white/20"
                  } ${editing ? "cursor-pointer hover:text-white/60" : ""}`}
                >
                  {capturingHotkeyFor === pad.id ? "…" : pad.hotkey || "—"}
                </span>
                <span className="text-3xl block mb-2">{brokenPads.has(pad.id) ? "⚠️" : "🎵"}</span>
                {editing ? (
                  <input
                    value={pad.name}
                    onChange={(e) => renamePad(pad.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-center text-[11px] font-medium text-white/70 border-b border-white/10 focus:outline-none"
                  />
                ) : (
                  <span className="text-[11px] font-medium text-white/60 block truncate" title={brokenPads.has(pad.id) ? "File not found" : pad.name}>
                    {pad.name}
                  </span>
                )}
              </button>
              {editing && (
                <button
                  onClick={() => removePad(pad.id)}
                  className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-red-500/80 text-white text-[10px] flex items-center justify-center hover:bg-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addPad}
            className="p-5 rounded-2xl border border-dashed border-white/[0.12] text-center text-white/30 hover:text-white/60 hover:border-white/25 transition-all flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">+</span>
            <span className="text-[11px] font-medium">Add Sound</span>
          </button>
        </div>

        {pads.length === 0 && (
          <Card padding={16} className="mt-6">
            <p className="text-[11px] text-white/25 leading-relaxed">
              🎵 Click "Add Sound" to pick .mp3, .wav, .ogg, .m4a, .flac, or .aac files from your computer. Click "Edit" to rename a
              sound, reassign its hotkey, or remove it. Hotkeys trigger sounds while this window has focus.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
