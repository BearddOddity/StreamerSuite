// Per-alert-kind custom icon overrides — shared with Multi-Chat's own
// chat-feed chips (raid/resub/gift/follow/tip/cheer), which read the same
// backing file (see alerts_get_event_icons/alerts_set_event_icons in
// alerts.rs) rather than keeping a separate copy. Alerts & Events is the
// only place with an upload UI for these; Multi-Chat is read-only.
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AlertKind } from "./types";

export type EventIcons = Partial<Record<AlertKind, string>>;

export function useEventIcons() {
  const [icons, setIcons] = useState<EventIcons>({});

  useEffect(() => {
    invoke<EventIcons>("alerts_get_event_icons")
      .then(setIcons)
      .catch(() => {});
  }, []);

  const setIcon = useCallback((kind: AlertKind, dataUri: string | null) => {
    setIcons((prev) => {
      const next = { ...prev };
      if (dataUri) next[kind] = dataUri;
      else delete next[kind];
      invoke("alerts_set_event_icons", { icons: next }).catch(() => {});
      return next;
    });
  }, []);

  return { icons, setIcon };
}
