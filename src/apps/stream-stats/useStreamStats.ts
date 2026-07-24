import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { KickStats, TwitchStats, ViewerSample } from "./types";

const POLL_INTERVAL_MS = 20_000;
const MAX_SAMPLES = 60; // ~20 minutes of history at the default poll interval
const KICK_SLUG_KEY = "streamersuite-stats-kick-slug";

export function useStreamStats() {
  const [twitchConnected, setTwitchConnected] = useState(false);
  const [twitch, setTwitch] = useState<TwitchStats | null>(null);
  const [twitchError, setTwitchError] = useState("");
  const [kickSlug, setKickSlugState] = useState(() => localStorage.getItem(KICK_SLUG_KEY) || "");
  const [kick, setKick] = useState<KickStats | null>(null);
  const [kickError, setKickError] = useState("");
  const [history, setHistory] = useState<ViewerSample[]>([]);
  const [peak, setPeak] = useState(0);

  const setKickSlug = useCallback((slug: string) => {
    setKickSlugState(slug);
    localStorage.setItem(KICK_SLUG_KEY, slug);
  }, []);

  const kickSlugRef = useRef(kickSlug);
  kickSlugRef.current = kickSlug;

  const poll = useCallback(async () => {
    const [config, twitchResult, kickResult] = await Promise.all([
      // Twitch connection status now comes from StreamerSuite's centralized
      // Routing config, not alerts-hub's own (now-removed) OAuth account —
      // twitch_stream_stats already reads the same shared credentials.
      invoke<{ broadcaster?: { twitch_token?: string; twitch_client?: string } }>("export_config").catch(() => null),
      invoke<TwitchStats>("twitch_stream_stats").catch((e: unknown) => e),
      kickSlugRef.current.trim()
        ? invoke<KickStats>("kick_channel_stats", { slug: kickSlugRef.current.trim() }).catch((e: unknown) => e)
        : Promise.resolve(null),
    ]);

    const connected = !!(config?.broadcaster?.twitch_token && config?.broadcaster?.twitch_client);
    setTwitchConnected(connected);
    if (connected) {
      if (twitchResult && typeof twitchResult === "object" && "is_live" in twitchResult) {
        setTwitch(twitchResult as TwitchStats);
        setTwitchError("");
      } else {
        setTwitchError(String(twitchResult));
      }
    } else {
      setTwitch(null);
    }

    if (kickResult === null) {
      setKick(null);
      setKickError("");
    } else if (kickResult && typeof kickResult === "object" && "is_live" in kickResult) {
      setKick(kickResult as KickStats);
      setKickError("");
    } else {
      setKickError(String(kickResult));
    }
  }, []);

  // Feeds the Overlay Maker's live-data-bound fields (see overlay_manager.rs's
  // /data-ws) so a "Followers" or "Viewers" field built there stays current
  // without Stream Stats needing to be the focused tool.
  useEffect(() => {
    const publish = (key: string, value: number | undefined) => {
      if (value === undefined) return;
      invoke("overlay_publish_data", { key, value }).catch(() => {});
    };
    const twitchViewers = twitch?.is_live ? twitch.viewer_count ?? 0 : 0;
    const kickViewers = kick?.is_live ? kick.viewer_count ?? 0 : 0;
    if (twitch || kick) publish("viewers", twitchViewers + kickViewers);
    publish("followers", twitch?.follower_total);
    publish("subscribers", twitch?.subscriber_total);
    const startedAt = twitch?.is_live ? twitch.started_at : kick?.is_live ? kick.started_at : undefined;
    if (startedAt) {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      publish("uptime", seconds);
    }
  }, [twitch, kick]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Default the Kick slug from StreamerSuite's centralized Routing config
  // the first time it's empty here, same as Multi-Chat and Alerts Hub —
  // one connection, not three separate slugs to keep typing in sync.
  useEffect(() => {
    if (kickSlugRef.current) return;
    invoke<{ broadcaster?: { kick_channel_id?: string } }>("export_config")
      .then((cfg) => {
        const slug = cfg?.broadcaster?.kick_channel_id;
        if (slug && !kickSlugRef.current) setKickSlug(slug);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real, in-session viewer history — sampled from actual polls, not
  // synthesized. Starts empty and fills in as polls land; nothing is
  // persisted across restarts.
  useEffect(() => {
    const twitchViewers = twitch?.is_live ? twitch.viewer_count ?? 0 : 0;
    const kickViewers = kick?.is_live ? kick.viewer_count ?? 0 : 0;
    if (!twitch && !kick) return;
    const total = twitchViewers + kickViewers;
    setHistory((prev) => [...prev, { timestamp: Date.now(), total }].slice(-MAX_SAMPLES));
    setPeak((prev) => Math.max(prev, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twitch?.viewer_count, twitch?.is_live, kick?.viewer_count, kick?.is_live]);

  const refresh = useCallback(() => poll(), [poll]);

  return { twitchConnected, twitch, twitchError, kickSlug, setKickSlug, kick, kickError, history, peak, refresh };
}
