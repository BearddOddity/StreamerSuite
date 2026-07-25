// Shared Streamer.bot WebSocket client — connection/auth handshake used by
// both Connections & Keys' Test Connection button and any tool that wants to
// actually run a Streamer.bot Action (e.g. Stream Manager's Kick fallback,
// since Kick's own public API sometimes hits the same Cloudflare block that
// Multi-Chat's direct Kick chat connection does).
import { tauriApi } from "@statusforge/hooks/useTauriApi";

interface StreamerBotMessage {
  authentication?: { salt: string; challenge: string };
  id?: string;
  status?: string;
  error?: string;
}

export async function sha256Base64(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Opens a WebSocket to Streamer.bot and completes the salt/challenge
 * handshake if a password is saved (streamerbot_get_password) — connects
 * unauthenticated if none is saved, same as Connections & Keys treats that
 * case. Resolves with an open, ready-to-use socket. */
export function streamerBotConnect(host: string, port: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${host || "127.0.0.1"}:${port || "8080"}/`);
    } catch (e) {
      reject(`invalid host/port: ${e}`);
      return;
    }
    const timeout = setTimeout(() => {
      ws.close();
      reject("timed out — is Streamer.bot running with the WebSocket Server enabled?");
    }, 5000);
    ws.onmessage = async (ev) => {
      let msg: StreamerBotMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.authentication) {
        const savedPassword = await tauriApi("streamerbot_get_password").catch(() => null);
        if (!savedPassword) {
          clearTimeout(timeout);
          resolve(ws);
          return;
        }
        const secret = await sha256Base64(savedPassword + msg.authentication.salt);
        const authentication = await sha256Base64(secret + msg.authentication.challenge);
        ws.send(JSON.stringify({ request: "Authenticate", authentication, id: "connect" }));
        return;
      }
      if (msg.id === "connect") {
        clearTimeout(timeout);
        if (msg.status === "ok") resolve(ws);
        else reject(msg.error || "authentication failed — check the Streamer.bot password");
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject("couldn't reach Streamer.bot at that host/port");
    };
  });
}

/** Runs a Streamer.bot Action by name over an already-connected socket,
 * passing `args` as the action-argument variables its sub-actions read
 * (e.g. a Kick "Set Channel Title" sub-action reading %title%). */
export function streamerBotDoAction(ws: WebSocket, actionName: string, args: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = `action-${Date.now()}`;
    const timeout = setTimeout(() => {
      ws.removeEventListener("message", handler);
      reject("Streamer.bot didn't respond to the action request");
    }, 8000);
    const handler = (ev: MessageEvent) => {
      let msg: StreamerBotMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.id !== id) return;
      clearTimeout(timeout);
      ws.removeEventListener("message", handler);
      if (msg.status === "ok") resolve();
      else reject(msg.error || "Streamer.bot returned an error running the action");
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ request: "DoAction", action: { name: actionName }, args, id }));
  });
}

/** One-shot: connect, run the configured Kick-update Action, close. The
 * Streamer.bot Action itself is user-authored (Kick > Channel > "Set
 * Channel Title" / "Set Channel Category" sub-actions reading %title%/
 * %category%) — this just triggers it with fresh values. */
export async function streamerBotUpdateKick(
  host: string,
  port: string,
  actionName: string,
  args: { title?: string; category?: string }
): Promise<void> {
  if (!actionName.trim()) {
    throw "No Streamer.bot action configured — set one in Settings → Connections & Keys.";
  }
  const filtered: Record<string, string> = {};
  if (args.title) filtered.title = args.title;
  if (args.category) filtered.category = args.category;
  if (Object.keys(filtered).length === 0) {
    throw "Nothing to update";
  }
  const ws = await streamerBotConnect(host, port);
  try {
    await streamerBotDoAction(ws, actionName, filtered);
  } finally {
    ws.close();
  }
}
