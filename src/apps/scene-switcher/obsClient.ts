// Client for OBS Studio's built-in obs-websocket v5 server (enabled via
// Tools -> WebSocket Server Settings, default ws://127.0.0.1:4455, optionally
// password-protected). This is an original implementation of just the subset
// of the protocol Scene Switcher needs (handshake/auth, request/response,
// events), written directly against the protocol spec
// (obsproject/obs-websocket docs/generated/protocol.md), not a copy of any
// existing obs-websocket client library.
//
// Wire protocol (WebSocketOpCode): Hello=0, Identify=1, Identified=2,
// Reidentify=3, Event=5, Request=6, RequestResponse=7, RequestBatch=8,
// RequestBatchResponse=9.
//
// Unlike Meld's WebChannel (client speaks first), obs-websocket is
// server-speaks-first: it sends Hello unprompted on connect, and the client
// replies with Identify (including the computed auth string if the server
// requires a password) before it can send any Request.

import type { MeldScene, MeldTrack } from "./types";

const OP = {
  hello: 0,
  identify: 1,
  identified: 2,
  event: 5,
  request: 6,
  requestResponse: 7,
} as const;

// obs-websocket's WebSocketCloseCode enum — only the code we branch on.
const CLOSE_AUTHENTICATION_FAILED = 4009;

// obs-websocket has bumped rpcVersion historically but 1 is what every
// released 5.x server understands; the server echoes back the version it
// negotiated in Identified if this ever needs to change.
const RPC_VERSION = 1;

// EventSubscription.All per the spec: every "normal" event category OR'd
// together. Deliberately excludes the high-frequency opt-in bits (e.g.
// InputVolumeMeters at 1<<16) that aren't part of "All" and that Scene
// Switcher has no use for.
const EVENT_SUBSCRIPTIONS_ALL =
  (1 << 0) | // General
  (1 << 1) | // Config
  (1 << 2) | // Scenes
  (1 << 3) | // Inputs
  (1 << 4) | // Transitions
  (1 << 5) | // Filters
  (1 << 6) | // Outputs
  (1 << 7) | // SceneItems
  (1 << 8) | // MediaInputs
  (1 << 9) | // Vendors
  (1 << 10) | // Ui
  (1 << 11); // Canvases

export interface ObsSnapshot {
  scenes: MeldScene[];
  tracks: MeldTrack[];
  isStreaming: boolean;
  isRecording: boolean;
}

async function sha256Base64(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  let binary = "";
  for (const b of new Uint8Array(digest)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** obs-websocket's password challenge-response: base64(sha256(password + salt)),
 *  then base64(sha256(that + challenge)). Uses Web Crypto only — no crypto lib. */
async function computeAuthString(password: string, challenge: string, salt: string): Promise<string> {
  const base64Secret = await sha256Base64(password + salt);
  return sha256Base64(base64Secret + challenge);
}

export class ObsClient {
  private ws: WebSocket | null = null;
  private nextId = 0;
  private callbacks = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private updateListeners = new Set<() => void>();
  private identified = false;
  private snapshot: ObsSnapshot = { scenes: [], tracks: [], isStreaming: false, isRecording: false };

  connect(url = "ws://127.0.0.1:4455", password = ""): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;
      let gotHello = false;

      ws.onmessage = async (ev) => {
        let msg: { op: number; d?: Record<string, unknown> };
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        const d = msg.d ?? {};

        if (msg.op === OP.hello) {
          gotHello = true;
          try {
            const auth = d.authentication as { challenge: string; salt: string } | undefined;
            const authentication = auth ? await computeAuthString(password, auth.challenge, auth.salt) : undefined;
            this.send({
              op: OP.identify,
              d: {
                rpcVersion: RPC_VERSION,
                eventSubscriptions: EVENT_SUBSCRIPTIONS_ALL,
                ...(authentication ? { authentication } : {}),
              },
            });
          } catch (e) {
            settled = true;
            reject(e instanceof Error ? e : new Error(String(e)));
            ws.close();
          }
        } else if (msg.op === OP.identified) {
          this.identified = true;
          settled = true;
          try {
            await this.refreshAll();
          } catch {
            // Non-fatal — start with an empty snapshot, events + retries recover it.
          }
          resolve();
        } else if (msg.op === OP.requestResponse) {
          const requestId = d.requestId as string | undefined;
          if (requestId === undefined) return;
          const cb = this.callbacks.get(requestId);
          if (!cb) return;
          this.callbacks.delete(requestId);
          const status = d.requestStatus as { result: boolean; code: number; comment?: string } | undefined;
          if (status?.result) {
            cb.resolve(d.responseData);
          } else {
            cb.reject(new Error(status?.comment || `OBS rejected request "${String(d.requestType)}" (code ${status?.code})`));
          }
        } else if (msg.op === OP.event) {
          this.handleEvent(d.eventType as string | undefined, d.eventData as Record<string, unknown> | undefined);
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(
            new Error("couldn't reach OBS — is it running with the WebSocket server enabled (Tools → WebSocket Server Settings)?")
          );
        }
      };

      ws.onclose = (ev) => {
        this.identified = false;
        this.callbacks.forEach((cb) => cb.reject(new Error("connection to OBS closed")));
        this.callbacks.clear();
        if (!settled) {
          settled = true;
          if (ev.code === CLOSE_AUTHENTICATION_FAILED) {
            reject(new Error("OBS rejected the password — check it against Tools → WebSocket Server Settings in OBS."));
          } else if (!gotHello) {
            reject(
              new Error("couldn't reach OBS — is it running with the WebSocket server enabled (Tools → WebSocket Server Settings)?")
            );
          } else {
            reject(new Error(`connection to OBS closed before it was ready (code ${ev.code})`));
          }
        }
        this.updateListeners.forEach((fn) => fn());
      };
    });
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.identified;
  }

  onUpdate(fn: () => void): () => void {
    this.updateListeners.add(fn);
    return () => this.updateListeners.delete(fn);
  }

  getSnapshot(): ObsSnapshot {
    return this.snapshot;
  }

  async showScene(sceneId: string): Promise<void> {
    await this.request("SetCurrentProgramScene", { sceneName: sceneId });
  }

  async toggleMute(trackId: string): Promise<void> {
    await this.request("ToggleInputMute", { inputName: trackId });
  }

  async toggleStream(): Promise<void> {
    await this.request("ToggleStream");
  }

  async toggleRecord(): Promise<void> {
    await this.request("ToggleRecord");
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.identified = false;
  }

  private send(data: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify(data));
  }

  private request<T = unknown>(requestType: string, requestData?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("not connected to OBS"));
    const requestId = String(this.nextId++);
    return new Promise((resolve, reject) => {
      this.callbacks.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
      this.send({ op: OP.request, d: { requestType, requestId, ...(requestData ? { requestData } : {}) } });
    });
  }

  private async refreshAll(): Promise<void> {
    const [scenes, tracks, stream, record] = await Promise.all([
      this.fetchScenes(),
      this.fetchTracks(),
      this.request<{ outputActive: boolean }>("GetStreamStatus"),
      this.request<{ outputActive: boolean }>("GetRecordStatus"),
    ]);
    this.snapshot = { scenes, tracks, isStreaming: !!stream.outputActive, isRecording: !!record.outputActive };
    this.updateListeners.forEach((fn) => fn());
  }

  private async fetchScenes(): Promise<MeldScene[]> {
    const data = await this.request<{
      scenes: { sceneName: string; sceneIndex: number }[];
      currentProgramSceneName: string | null;
      currentPreviewSceneName: string | null;
    }>("GetSceneList");
    const scenes: MeldScene[] = (data.scenes || []).map((s) => ({
      id: s.sceneName,
      name: s.sceneName,
      index: s.sceneIndex,
      current: s.sceneName === data.currentProgramSceneName,
      // OBS's "preview" scene (studio mode) is the closest analog to Meld's "staged".
      staged: !!data.currentPreviewSceneName && s.sceneName === data.currentPreviewSceneName,
    }));
    scenes.sort((a, b) => a.index - b.index);
    return scenes;
  }

  private async fetchTracks(): Promise<MeldTrack[]> {
    const data = await this.request<{ inputs: { inputName: string }[] }>("GetInputList");
    // obs-websocket has no single "list the audio inputs" request — GetInputMute
    // errors for inputs that don't carry audio, so probing it per input is the
    // documented way to separate audio-capable inputs from everything else.
    const results = await Promise.all(
      (data.inputs || []).map(async (input): Promise<MeldTrack | null> => {
        try {
          const mute = await this.request<{ inputMuted: boolean }>("GetInputMute", { inputName: input.inputName });
          return { id: input.inputName, name: input.inputName, muted: !!mute.inputMuted, monitoring: false };
        } catch {
          return null;
        }
      })
    );
    return results.filter((t): t is MeldTrack => t !== null);
  }

  private handleEvent(eventType: string | undefined, eventData: Record<string, unknown> | undefined): void {
    switch (eventType) {
      case "CurrentProgramSceneChanged": {
        const name = eventData?.sceneName as string | undefined;
        this.snapshot = { ...this.snapshot, scenes: this.snapshot.scenes.map((s) => ({ ...s, current: s.name === name })) };
        this.updateListeners.forEach((fn) => fn());
        break;
      }
      case "SceneListChanged":
        this.fetchScenes()
          .then((scenes) => {
            this.snapshot = { ...this.snapshot, scenes };
            this.updateListeners.forEach((fn) => fn());
          })
          .catch(() => {});
        break;
      case "InputMuteStateChanged": {
        const name = eventData?.inputName as string | undefined;
        const muted = !!eventData?.inputMuted;
        this.snapshot = { ...this.snapshot, tracks: this.snapshot.tracks.map((t) => (t.id === name ? { ...t, muted } : t)) };
        this.updateListeners.forEach((fn) => fn());
        break;
      }
      case "StreamStateChanged":
        this.snapshot = { ...this.snapshot, isStreaming: !!eventData?.outputActive };
        this.updateListeners.forEach((fn) => fn());
        break;
      case "RecordStateChanged":
        this.snapshot = { ...this.snapshot, isRecording: !!eventData?.outputActive };
        this.updateListeners.forEach((fn) => fn());
        break;
      default:
        break;
    }
  }
}
