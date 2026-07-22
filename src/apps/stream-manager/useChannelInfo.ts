import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { KickChannelInfo, TwitchChannelInfo } from "./types";

export function useTwitchChannelInfo() {
  const [twitch, setTwitch] = useState<TwitchChannelInfo | null>(null);
  const [twitchError, setTwitchError] = useState("");
  const [twitchSaving, setTwitchSaving] = useState(false);
  const [twitchSaved, setTwitchSaved] = useState(false);

  const loadTwitch = useCallback(async () => {
    try {
      const info = await invoke<TwitchChannelInfo>("stream_manager_get_twitch_info");
      setTwitch(info);
      setTwitchError("");
    } catch (e) {
      setTwitchError(String(e));
    }
  }, []);

  useEffect(() => {
    loadTwitch();
  }, [loadTwitch]);

  const updateTwitch = useCallback(
    async (patch: { title?: string; game_name?: string; tags?: string[] }) => {
      setTwitchSaving(true);
      setTwitchError("");
      setTwitchSaved(false);
      try {
        await invoke("stream_manager_update_twitch", patch);
        await loadTwitch();
        setTwitchSaved(true);
        setTimeout(() => setTwitchSaved(false), 2500);
      } catch (e) {
        setTwitchError(String(e));
      } finally {
        setTwitchSaving(false);
      }
    },
    [loadTwitch]
  );

  return { twitch, twitchError, twitchSaving, twitchSaved, updateTwitch };
}

export function useKickChannelInfo() {
  const [kick, setKick] = useState<KickChannelInfo | null>(null);
  const [kickError, setKickError] = useState("");
  const [kickSaving, setKickSaving] = useState(false);
  const [kickSaved, setKickSaved] = useState(false);

  const loadKick = useCallback(async () => {
    try {
      const info = await invoke<KickChannelInfo>("stream_manager_get_kick_info");
      setKick(info);
      setKickError("");
    } catch (e) {
      setKickError(String(e));
    }
  }, []);

  useEffect(() => {
    loadKick();
  }, [loadKick]);

  const updateKick = useCallback(
    async (patch: { title?: string; category_name?: string }) => {
      setKickSaving(true);
      setKickError("");
      setKickSaved(false);
      try {
        await invoke("stream_manager_update_kick", patch);
        await loadKick();
        setKickSaved(true);
        setTimeout(() => setKickSaved(false), 2500);
      } catch (e) {
        setKickError(String(e));
      } finally {
        setKickSaving(false);
      }
    },
    [loadKick]
  );

  return { kick, kickError, kickSaving, kickSaved, updateKick };
}
