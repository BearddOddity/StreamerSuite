import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { HOTKEY_POOL, PAD_COLORS, type SoundPad } from "./types";

const PADS_KEY = "streamersuite-soundboard-pads";
const VOLUME_KEY = "streamersuite-soundboard-master-volume";

function loadPads(): SoundPad[] {
  try {
    const raw = localStorage.getItem(PADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  const last = parts[parts.length - 1] || path;
  return last.replace(/\.[^.]+$/, "");
}

export function useSoundBoard() {
  const [pads, setPads] = useState<SoundPad[]>(loadPads);
  const [masterVolume, setMasterVolume] = useState(() => Number(localStorage.getItem(VOLUME_KEY)) || 75);
  const [activePad, setActivePad] = useState<string | null>(null);
  const [brokenPads, setBrokenPads] = useState<Set<string>>(new Set());
  const audioPool = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    localStorage.setItem(PADS_KEY, JSON.stringify(pads));
  }, [pads]);
  useEffect(() => {
    localStorage.setItem(VOLUME_KEY, String(masterVolume));
  }, [masterVolume]);

  const nextHotkey = useCallback(
    (existing: SoundPad[]) => HOTKEY_POOL.find((k) => !existing.some((p) => p.hotkey === k)) || "",
    []
  );

  const addPad = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac", "aac"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setPads((prev) => {
      const next = [...prev];
      paths.forEach((filePath, i) => {
        next.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name: fileName(filePath),
          filePath,
          hotkey: nextHotkey(next),
          color: PAD_COLORS[next.length % PAD_COLORS.length]!,
          volume: 100,
        });
      });
      return next;
    });
  }, [nextHotkey]);

  const removePad = useCallback((id: string) => {
    setPads((prev) => prev.filter((p) => p.id !== id));
    audioPool.current.delete(id);
  }, []);

  const renamePad = useCallback((id: string, name: string) => {
    setPads((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const setPadHotkey = useCallback((id: string, hotkey: string) => {
    setPads((prev) => prev.map((p) => (p.id === id ? { ...p, hotkey } : p.hotkey === hotkey ? { ...p, hotkey: "" } : p)));
  }, []);

  const setPadVolume = useCallback((id: string, volume: number) => {
    setPads((prev) => prev.map((p) => (p.id === id ? { ...p, volume } : p)));
  }, []);

  const play = useCallback(
    (pad: SoundPad) => {
      let audio = audioPool.current.get(pad.id);
      if (!audio) {
        audio = new Audio(convertFileSrc(pad.filePath));
        audioPool.current.set(pad.id, audio);
        audio.addEventListener("error", () => setBrokenPads((prev) => new Set(prev).add(pad.id)));
      }
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, (masterVolume / 100) * (pad.volume / 100)));
      audio.play().catch(() => setBrokenPads((prev) => new Set(prev).add(pad.id)));
      setBrokenPads((prev) => {
        if (!prev.has(pad.id)) return prev;
        const next = new Set(prev);
        next.delete(pad.id);
        return next;
      });
      setActivePad(pad.id);
      setTimeout(() => setActivePad((cur) => (cur === pad.id ? null : cur)), 300);
    },
    [masterVolume]
  );

  const stopAll = useCallback(() => {
    audioPool.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  // Trigger pads by keyboard, ignoring keystrokes while typing in an input/textarea.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      const pad = pads.find((p) => p.hotkey === key);
      if (pad) play(pad);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pads, play]);

  return { pads, masterVolume, setMasterVolume, activePad, brokenPads, addPad, removePad, renamePad, setPadHotkey, setPadVolume, play, stopAll };
}
