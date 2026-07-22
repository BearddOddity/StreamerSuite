import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KNOWN_LIVE_SOURCES, humanizeSourceKey } from "./types";

const POLL_MS = 4000;

/**
 * The list of live-data sources to offer in the Maker's "bind to a live
 * source" dropdown: the small set of sources StreamerSuite tools are known
 * to publish (KNOWN_LIVE_SOURCES, shown even before that tool has run) plus
 * whatever overlay_list_data_keys() reports has actually been published —
 * which covers any future tool this file was never updated for, the moment
 * it publishes its first value. Polls while the Maker is open so a source
 * that shows up mid-session (e.g. you just switched scenes for the first
 * time) appears without reopening the modal.
 */
export function useLiveSources() {
  const [sources, setSources] = useState(KNOWN_LIVE_SOURCES);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      invoke<string[]>("overlay_list_data_keys")
        .then((keys) => {
          if (cancelled) return;
          const known = new Set(KNOWN_LIVE_SOURCES.map((s) => s.value));
          const discovered = keys
            .filter((k) => !known.has(k))
            .map((k) => ({ value: k, label: `${humanizeSourceKey(k)} (discovered)` }));
          setSources(discovered.length ? [...KNOWN_LIVE_SOURCES, ...discovered] : KNOWN_LIVE_SOURCES);
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return sources;
}
