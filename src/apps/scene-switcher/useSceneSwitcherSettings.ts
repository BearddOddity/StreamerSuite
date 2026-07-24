import { useCallback, useEffect, useState } from "react";
import type { SceneSwitcherSettings } from "./types";
import { defaultSceneSwitcherSettings } from "./types";

const STORAGE_KEY = "streamersuite-scene-switcher-settings";

function load(): SceneSwitcherSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSceneSwitcherSettings;
    const parsed = JSON.parse(raw);
    return { ...defaultSceneSwitcherSettings, ...parsed };
  } catch {
    return defaultSceneSwitcherSettings;
  }
}

export function useSceneSwitcherSettings() {
  const [settings, setSettings] = useState<SceneSwitcherSettings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<SceneSwitcherSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update };
}
