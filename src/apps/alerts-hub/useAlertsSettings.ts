import { useCallback, useEffect, useState } from "react";
import type { AlertsSettings } from "./types";
import { defaultAlertsSettings } from "./types";

const STORAGE_KEY = "streamersuite-alerts-settings";

function load(): AlertsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAlertsSettings;
    const parsed = JSON.parse(raw);
    return {
      ...defaultAlertsSettings,
      ...parsed,
      enabled: { ...defaultAlertsSettings.enabled, ...parsed.enabled },
    };
  } catch {
    return defaultAlertsSettings;
  }
}

export function useAlertsSettings() {
  const [settings, setSettings] = useState<AlertsSettings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<AlertsSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggle = useCallback((key: keyof AlertsSettings["enabled"]) => {
    setSettings((prev) => ({ ...prev, enabled: { ...prev.enabled, [key]: !prev.enabled[key] } }));
  }, []);

  return { settings, update, toggle };
}
