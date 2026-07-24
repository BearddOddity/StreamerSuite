import { useCallback, useEffect, useRef, useState } from "react";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { MeldClient } from "./meldClient";
import { ObsClient } from "./obsClient";
import type { MeldConnectionStatus, MeldScene, MeldTrack, ScenePlatform } from "./types";

interface SessionItem {
  type?: string;
  index?: number;
  name?: string;
  current?: boolean;
  staged?: boolean;
  muted?: boolean;
  monitoring?: boolean;
}

function deriveScenesAndTracks(sessionItems: Record<string, SessionItem> | undefined): { scenes: MeldScene[]; tracks: MeldTrack[] } {
  const scenes: MeldScene[] = [];
  const tracks: MeldTrack[] = [];
  if (!sessionItems) return { scenes, tracks };
  for (const [id, item] of Object.entries(sessionItems)) {
    if (item.type === "scene") {
      scenes.push({ id, name: item.name || id, index: item.index ?? 0, current: !!item.current, staged: !!item.staged });
    } else if (item.type === "track") {
      tracks.push({ id, name: item.name || id, muted: !!item.muted, monitoring: !!item.monitoring });
    }
  }
  scenes.sort((a, b) => a.index - b.index);
  return { scenes, tracks };
}

export interface ObsConnectionParams {
  host: string;
  port: number;
  password: string;
}

type SceneClient = MeldClient | ObsClient;

// Platform-aware successor to the old useMeldConnection: holds either a
// MeldClient or an ObsClient (never both) behind the same public shape, so
// App.tsx doesn't need to know or care which platform is actually backing it.
export function useSceneSwitcherConnection(platform: ScenePlatform, obsSettings: ObsConnectionParams) {
  const [status, setStatus] = useState<MeldConnectionStatus>("disconnected");
  const [scenes, setScenes] = useState<MeldScene[]>([]);
  const [tracks, setTracks] = useState<MeldTrack[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  // The client currently backing the UI. A ref (not state) because the
  // WebSocket lifecycle is imperative — React only needs to re-render when
  // the derived status/scenes/etc change, not on every internal handshake step.
  const clientRef = useRef<SceneClient | null>(null);
  // OBS host/port/password read at connect-time rather than as a `connect`
  // dependency, so editing settings mid-session doesn't itself tear down a
  // live connection — the user picks up new settings by reconnecting.
  const obsSettingsRef = useRef(obsSettings);
  useEffect(() => {
    obsSettingsRef.current = obsSettings;
  }, [obsSettings]);

  const refresh = useCallback((client: SceneClient) => {
    if (client instanceof MeldClient) {
      const session = client.getProperty<{ items?: Record<string, SessionItem> }>("session");
      const { scenes: s, tracks: t } = deriveScenesAndTracks(session?.items);
      setScenes(s);
      setTracks(t);
      setIsStreaming(!!client.getProperty<boolean>("isStreaming"));
      setIsRecording(!!client.getProperty<boolean>("isRecording"));
    } else {
      const snap = client.getSnapshot();
      setScenes(snap.scenes);
      setTracks(snap.tracks);
      setIsStreaming(snap.isStreaming);
      setIsRecording(snap.isRecording);
    }
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current?.connected) return () => {};
    setStatus("connecting");
    setError("");
    const client: SceneClient = platform === "obs" ? new ObsClient() : new MeldClient();
    // Guards against React StrictMode's dev-only double-invoke of effects:
    // if this attempt is superseded (component unmounted / platform switched /
    // a newer connect() started) before the handshake finishes, don't let its
    // late resolution clobber clientRef or push stale state — just close it.
    let superseded = false;

    const connectPromise =
      client instanceof ObsClient
        ? client.connect(`ws://${obsSettingsRef.current.host}:${obsSettingsRef.current.port}`, obsSettingsRef.current.password)
        : client.connect();

    connectPromise
      .then(() => {
        if (superseded) {
          client.close();
          return;
        }
        clientRef.current = client;
        client.onUpdate(() => refresh(client));
        if (client instanceof MeldClient) {
          client.connectSignal("sessionChanged");
          client.connectSignal("isStreamingChanged");
          client.connectSignal("isRecordingChanged");
        }
        setStatus("connected");
        refresh(client);
      })
      .catch((e: unknown) => {
        if (superseded) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      superseded = true;
      client.close();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [platform, refresh]);

  // Re-runs on mount and whenever the selected platform changes — switching
  // Meld <-> OBS tears down whichever client was active and connects fresh
  // to the newly selected one, same auto-connect behavior as before.
  useEffect(() => {
    const cancel = connect();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  // Feeds the Overlay Maker's live-data-bound fields (see overlay_manager.rs's
  // /data-ws) so a "Now Playing" style overlay can show the current scene,
  // regardless of which platform is providing it.
  useEffect(() => {
    const current = scenes.find((s) => s.current);
    if (!current) return;
    tauriInvoke("overlay_publish_data", { key: "scene", value: current.name }).catch(() => {});
  }, [scenes]);

  // Detect a dropped connection (app closed / OBS or Meld stopped) and flip status back.
  useEffect(() => {
    const id = setInterval(() => {
      if (status === "connected" && !clientRef.current?.connected) setStatus("disconnected");
    }, 2000);
    return () => clearInterval(id);
  }, [status]);

  const showScene = useCallback(async (sceneId: string) => {
    try {
      const client = clientRef.current;
      if (client instanceof MeldClient) await client.invoke("showScene", sceneId);
      else if (client instanceof ObsClient) await client.showScene(sceneId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggleMute = useCallback(async (trackId: string) => {
    try {
      const client = clientRef.current;
      if (client instanceof MeldClient) await client.invoke("toggleMute", trackId);
      else if (client instanceof ObsClient) await client.toggleMute(trackId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggleStream = useCallback(async () => {
    try {
      const client = clientRef.current;
      if (client instanceof MeldClient) await client.invoke("toggleStream");
      else if (client instanceof ObsClient) await client.toggleStream();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggleRecord = useCallback(async () => {
    try {
      const client = clientRef.current;
      if (client instanceof MeldClient) await client.invoke("toggleRecord");
      else if (client instanceof ObsClient) await client.toggleRecord();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  return { status, error, scenes, tracks, isStreaming, isRecording, connect: reconnect, showScene, toggleMute, toggleStream, toggleRecord };
}
