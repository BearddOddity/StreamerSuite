import { useCallback, useEffect, useRef, useState } from "react";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { MeldClient } from "./meldClient";
import type { MeldConnectionStatus, MeldScene, MeldTrack } from "./types";

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

export function useMeldConnection() {
  const [status, setStatus] = useState<MeldConnectionStatus>("disconnected");
  const [scenes, setScenes] = useState<MeldScene[]>([]);
  const [tracks, setTracks] = useState<MeldTrack[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  // The client currently backing the UI. A ref (not state) because the
  // WebSocket lifecycle is imperative — React only needs to re-render when
  // the derived status/scenes/etc change, not on every internal handshake step.
  const clientRef = useRef<MeldClient | null>(null);

  const refresh = useCallback((client: MeldClient) => {
    const session = client.getProperty<{ items?: Record<string, SessionItem> }>("session");
    const { scenes: s, tracks: t } = deriveScenesAndTracks(session?.items);
    setScenes(s);
    setTracks(t);
    setIsStreaming(!!client.getProperty<boolean>("isStreaming"));
    setIsRecording(!!client.getProperty<boolean>("isRecording"));
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current?.connected) return () => {};
    setStatus("connecting");
    setError("");
    const client = new MeldClient();
    // Guards against React StrictMode's dev-only double-invoke of effects:
    // if this attempt is superseded (component unmounted / a newer connect()
    // started) before the handshake finishes, don't let its late resolution
    // clobber clientRef or push stale state — just close it and stop.
    let superseded = false;

    client
      .connect()
      .then(() => {
        if (superseded) {
          client.close();
          return;
        }
        clientRef.current = client;
        client.onUpdate(() => refresh(client));
        client.connectSignal("sessionChanged");
        client.connectSignal("isStreamingChanged");
        client.connectSignal("isRecordingChanged");
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
  }, [refresh]);

  useEffect(() => {
    const cancel = connect();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feeds the Overlay Maker's live-data-bound fields (see overlay_manager.rs's
  // /data-ws) so a "Now Playing" style overlay can show the current scene.
  useEffect(() => {
    const current = scenes.find((s) => s.current);
    if (!current) return;
    tauriInvoke("overlay_publish_data", { key: "scene", value: current.name }).catch(() => {});
  }, [scenes]);

  // Detect a dropped connection (Meld closed) and flip status back.
  useEffect(() => {
    const id = setInterval(() => {
      if (status === "connected" && !clientRef.current?.connected) setStatus("disconnected");
    }, 2000);
    return () => clearInterval(id);
  }, [status]);

  const showScene = useCallback(async (sceneId: string) => {
    try {
      await clientRef.current?.invoke("showScene", sceneId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggleMute = useCallback(async (trackId: string) => {
    try {
      await clientRef.current?.invoke("toggleMute", trackId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggleStream = useCallback(async () => {
    try {
      await clientRef.current?.invoke("toggleStream");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggleRecord = useCallback(async () => {
    try {
      await clientRef.current?.invoke("toggleRecord");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  return { status, error, scenes, tracks, isStreaming, isRecording, connect: reconnect, showScene, toggleMute, toggleStream, toggleRecord };
}
