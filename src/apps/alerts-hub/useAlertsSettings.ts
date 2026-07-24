import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

  // Default the Kick slug from StreamerSuite's centralized Routing config
  // (broadcaster.kick_channel_id — the same field Multi-Chat's channel
  // field now defaults from) the first time it's empty here, instead of
  // requiring the same channel typed in a third time.
  useEffect(() => {
    if (settings.kickSlug) return;
    let cancelled = false;
    invoke<{ broadcaster?: { kick_channel_id?: string } }>("export_config")
      .then((cfg) => {
        const slug = cfg?.broadcaster?.kick_channel_id;
        if (!cancelled && slug) update({ kickSlug: slug });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback((key: keyof AlertsSettings["enabled"]) => {
    setSettings((prev) => ({ ...prev, enabled: { ...prev.enabled, [key]: !prev.enabled[key] } }));
  }, []);

  return { settings, update, toggle };
}
