import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AlertEvent, AlertsSettings, TwitchAccount } from "./types";

const MAX_ALERTS = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// A cheerful two-tone chime, synthesized (no bundled audio asset needed).
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.4);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // best-effort — a failed beep shouldn't break the alert feed
  }
}

export function useAlertsFeed(settings: AlertsSettings) {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [twitchAccount, setTwitchAccount] = useState<TwitchAccount | null>(null);
  const [twitchStatus, setTwitchStatus] = useState<"disconnected" | "connecting" | "live" | "error">("disconnected");
  const [kickStatus, setKickStatus] = useState<"disconnected" | "connecting" | "live" | "error">("disconnected");
  const [joystickStatus, setJoystickStatus] = useState<"disconnected" | "connecting" | "live" | "error">("disconnected");
  const [chaturbateStatus, setChaturbateStatus] = useState<"disconnected" | "connecting" | "live" | "error">("disconnected");

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const push = useCallback((event: Omit<AlertEvent, "id" | "timestamp">) => {
    const alert: AlertEvent = { ...event, id: generateId(), timestamp: Date.now() };
    setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));
    if (settingsRef.current.soundEnabled) playChime();
    // Fan out to the /alerts-ws overlay (Overlay Library) too, so an OBS/Meld
    // browser source shows the same alert — a no-op if nothing's connected.
    invoke("alerts_broadcast_to_overlay", { event: alert }).catch(() => {});
    // Also feeds the Overlay Maker's live-data-bound fields (a separate,
    // generic "current value" path from the dedicated alerts-ws stream
    // above) so e.g. a lower-third can show "Latest: X just followed!".
    invoke("overlay_publish_data", { key: "latest_alert", value: `${alert.user} ${alert.message}` }).catch(() => {});
  }, []);

  // Twitch is connected centrally now (Settings → Connections & Keys) — read
  // the shared AppConfig instead of a separate Alerts Hub OAuth connection.
  // `username` isn't stored in AppConfig, only the broadcaster id, so this
  // just reports the connection as present/absent rather than by name.
  const refreshTwitchAccount = useCallback(async () => {
    try {
      const config = await invoke<{
        broadcaster?: { twitch_token?: string; twitch_client?: string; twitch_broadcaster_id?: string };
      }>("export_config");
      const b = config.broadcaster;
      if (b?.twitch_token && b?.twitch_client && b?.twitch_broadcaster_id) {
        const account: TwitchAccount = { username: "Connected", user_id: b.twitch_broadcaster_id };
        setTwitchAccount(account);
        return account;
      }
      setTwitchAccount(null);
      return null;
    } catch {
      setTwitchAccount(null);
      return null;
    }
  }, []);

  // ── Twitch — EventSub over WebSocket ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let keepaliveTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect(url?: string) {
      const account = await refreshTwitchAccount();
      if (cancelled || !account) {
        setTwitchStatus("disconnected");
        return;
      }
      setTwitchStatus("connecting");
      const socket = new WebSocket(url || "wss://eventsub.wss.twitch.tv/ws");
      ws = socket;

      const armKeepalive = (seconds: number) => {
        if (keepaliveTimer) clearTimeout(keepaliveTimer);
        keepaliveTimer = setTimeout(() => socket.close(), (seconds + 10) * 1000);
      };

      socket.onmessage = async (ev) => {
        let frame: { metadata?: Record<string, unknown>; payload?: Record<string, unknown> };
        try {
          frame = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        const meta = frame.metadata || {};
        const payload = frame.payload || {};
        const messageType = meta.message_type as string | undefined;

        if (messageType === "session_welcome") {
          const session = payload.session as { id: string; keepalive_timeout_seconds?: number };
          armKeepalive(session.keepalive_timeout_seconds || 10);
          setTwitchStatus("live");
          const userId = account.user_id;
          const subs = settingsRef.current.enabled;
          const subscribe = (subType: string, version: string, condition: Record<string, string>) =>
            invoke("alerts_eventsub_subscribe", { sessionId: session.id, subType, version, condition }).catch(() => {});
          if (subs.twitchFollow) subscribe("channel.follow", "2", { broadcaster_user_id: userId, moderator_user_id: userId });
          if (subs.twitchSub) {
            subscribe("channel.subscribe", "1", { broadcaster_user_id: userId });
            subscribe("channel.subscription.gift", "1", { broadcaster_user_id: userId });
            subscribe("channel.subscription.message", "1", { broadcaster_user_id: userId });
          }
          if (subs.twitchRaid) subscribe("channel.raid", "1", { to_broadcaster_user_id: userId });
          if (subs.twitchCheer) subscribe("channel.cheer", "1", { broadcaster_user_id: userId });
        } else if (messageType === "session_keepalive") {
          armKeepalive(10);
        } else if (messageType === "session_reconnect") {
          if (keepaliveTimer) clearTimeout(keepaliveTimer);
          const session = payload.session as { reconnect_url: string };
          connect(session.reconnect_url);
        } else if (messageType === "notification") {
          armKeepalive(10);
          const subType = meta.subscription_type as string;
          const event = payload.event as Record<string, unknown>;
          handleTwitchNotification(subType, event, push);
        } else if (messageType === "revocation") {
          setTwitchStatus("error");
        }
      };
      socket.onclose = () => {
        if (keepaliveTimer) clearTimeout(keepaliveTimer);
        if (ws === socket && !cancelled) {
          setTwitchStatus("disconnected");
          reconnectTimer = setTimeout(() => connect(), 5000);
        }
      };
      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (keepaliveTimer) clearTimeout(keepaliveTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push, refreshTwitchAccount, settings.enabled.twitchFollow, settings.enabled.twitchSub, settings.enabled.twitchRaid, settings.enabled.twitchCheer]);

  // ── Kick — public Pusher chatroom channel (no OAuth) ──────────────────
  useEffect(() => {
    const slug = settings.kickSlug.trim().toLowerCase();
    if (!slug) {
      setKickStatus("disconnected");
      return;
    }
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      setKickStatus("connecting");
      let chatroomId: number;
      try {
        chatroomId = await invoke<number>("resolve_kick_chatroom", { slug });
      } catch {
        if (!cancelled) setKickStatus("error");
        return;
      }
      if (cancelled) return;
      const socket = new WebSocket(
        "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false"
      );
      ws = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${chatroomId}.v2` } }));
      };
      socket.onmessage = (ev) => {
        let frame: { event?: string; data?: string };
        try {
          frame = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (frame.event === "pusher:ping") {
          socket.send(JSON.stringify({ event: "pusher:pong", data: {} }));
          return;
        }
        if (frame.event === "pusher_internal:subscription_succeeded") {
          setKickStatus("live");
          return;
        }
        if (!frame.event || !/SubscriptionEvent|GiftedSubscriptionsEvent|StreamHostEvent/.test(frame.event)) return;
        let d: Record<string, unknown>;
        try {
          d = JSON.parse(frame.data || "{}");
        } catch {
          return;
        }
        const subs = settingsRef.current.enabled;
        if (frame.event.includes("GiftedSubscriptions") && subs.kickSub) {
          const count = (d.gifted_usernames as unknown[] | undefined)?.length || (d.gifted_quantity as number) || 1;
          push({ platform: "kick", kind: "sub", user: (d.gifter_username as string) || "Someone", message: `gifted ${count} sub${count === 1 ? "" : "s"}!`, amount: String(count) });
        } else if (frame.event.includes("Subscription") && subs.kickSub) {
          push({ platform: "kick", kind: "sub", user: (d.username as string) || "Someone", message: "subscribed!", amount: d.months ? String(d.months) : undefined });
        } else if (frame.event.includes("StreamHost") && subs.kickHost) {
          push({ platform: "kick", kind: "raid", user: (d.host_username as string) || "Someone", message: "is hosting!", amount: d.number_viewers ? String(d.number_viewers) : undefined });
        }
      };
      socket.onclose = () => {
        if (ws === socket && !cancelled) {
          setKickStatus("disconnected");
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
      socket.onerror = () => socket.close();
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [settings.kickSlug, push]);

  // ── Joystick.tv — ActionCable gateway (shares Multi-Chat's bot key) ──
  useEffect(() => {
    if (!settings.enabled.joystickTip) {
      setJoystickStatus("disconnected");
      return;
    }
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      setJoystickStatus("connecting");
      // Bearer JWT, not a Base64(client_id:secret) key — confirmed against
      // Joystick's own reference client (github.com/joysticktv/jtv). The
      // Rust side refreshes it first if it looks stale.
      const token = await invoke<string | null>("joystick_get_gateway_token").catch(() => null);
      if (cancelled) return;
      if (!token) {
        setJoystickStatus("disconnected");
        return;
      }
      const socket = new WebSocket("wss://joystick.tv/cable?token=" + encodeURIComponent(token), "actioncable-v1-json");
      ws = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ command: "subscribe", identifier: JSON.stringify({ channel: "GatewayChannel" }) }));
      };
      socket.onmessage = (ev) => {
        let d: { type?: string; message?: Record<string, unknown> };
        try {
          d = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (d.type === "confirm_subscription") {
          setJoystickStatus("live");
          return;
        }
        if (d.type === "reject_subscription") {
          setJoystickStatus("error");
          return;
        }
        const msg = d.message;
        if (msg && msg.event === "StreamEvent" && msg.type === "Tipped" && typeof msg.text === "string") {
          const text = msg.text.replace(/<[^>]*>/g, "");
          const m = /^(.+?)\s+tipped\s+(\d+)\s+tokens?(?:\s+for\s+(.+))?$/i.exec(text.trim());
          if (m) {
            push({ platform: "joystick", kind: "tip", user: m[1]!, message: m[3] ? `tipped for "${m[3]}"` : "sent a tip!", amount: m[2] });
          }
        }
      };
      socket.onclose = () => {
        if (ws === socket && !cancelled) {
          setJoystickStatus("disconnected");
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
      socket.onerror = () => socket.close();
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [settings.enabled.joystickTip, push]);

  // ── Chaturbate — Events API long-poll (devportal.cb.dev) ──
  // Read-only: chatMessage and tip events go to Multi-Chat's own feed (see
  // multichat.js), this tool only cares about tip and follow as alerts.
  // Field names (isMod, inFanclub, isAnon, tokens) are the raw camelCase
  // Chaturbate's API returns, per its official reference client
  // (github.com/MountainGod2/chaturbate_poller) — the Rust side proxies the
  // response untouched.
  useEffect(() => {
    if (!settings.enabled.chaturbateTip && !settings.enabled.chaturbateFollow) {
      setChaturbateStatus("disconnected");
      return;
    }
    let cancelled = false;
    let nextUrl: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      setChaturbateStatus("connecting");
      while (!cancelled) {
        let resp: { events?: { method?: string; object?: Record<string, unknown> }[]; nextUrl?: string } | null;
        try {
          resp = await invoke("chaturbate_poll_events", { nextUrl });
        } catch {
          if (cancelled) return;
          setChaturbateStatus("error");
          timer = setTimeout(poll, 5000);
          return;
        }
        if (cancelled) return;
        setChaturbateStatus("live");
        for (const ev of resp?.events ?? []) {
          const obj = ev.object ?? {};
          const user = (obj.user as Record<string, unknown> | undefined) ?? {};
          const username = typeof user.username === "string" ? user.username : "unknown";
          if (ev.method === "tip" && settingsRef.current.enabled.chaturbateTip) {
            const tip = (obj.tip as Record<string, unknown> | undefined) ?? {};
            const isAnon = !!tip.isAnon;
            const tokens = typeof tip.tokens === "number" ? String(tip.tokens) : "0";
            push({ platform: "chaturbate", kind: "tip", user: isAnon ? "Anonymous" : username, message: "sent a tip!", amount: tokens });
          } else if (ev.method === "follow" && settingsRef.current.enabled.chaturbateFollow) {
            push({ platform: "chaturbate", kind: "follow", user: username, message: "just followed!" });
          }
        }
        nextUrl = resp?.nextUrl ?? null;
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [settings.enabled.chaturbateTip, settings.enabled.chaturbateFollow, push]);

  const clear = useCallback(() => setAlerts([]), []);

  return {
    alerts, push, clear, twitchAccount, refreshTwitchAccount,
    twitchStatus, kickStatus, joystickStatus, chaturbateStatus,
  };
}

function handleTwitchNotification(
  subType: string,
  event: Record<string, unknown>,
  push: (e: Omit<AlertEvent, "id" | "timestamp">) => void
) {
  const user = (event.user_name as string) || (event.user_login as string) || "Someone";
  switch (subType) {
    case "channel.follow":
      push({ platform: "twitch", kind: "follow", user, message: "just followed!" });
      break;
    case "channel.subscribe":
      if (event.is_gift) return; // the paired subscription.gift notification covers this
      push({ platform: "twitch", kind: "sub", user, message: `subscribed (tier ${formatTier(event.tier)})!` });
      break;
    case "channel.subscription.gift": {
      const total = (event.total as number) ?? 1;
      const gifter = (event.is_anonymous ? "An anonymous cheermate" : user) || "Someone";
      push({ platform: "twitch", kind: "sub", user: gifter, message: `gifted ${total} sub${total === 1 ? "" : "s"}!`, amount: String(total) });
      break;
    }
    case "channel.subscription.message": {
      const months = (event.cumulative_months as number) ?? undefined;
      push({ platform: "twitch", kind: "sub", user, message: `resubscribed${months ? ` for ${months} months` : ""}!`, amount: months ? String(months) : undefined });
      break;
    }
    case "channel.raid": {
      const raider = (event.from_broadcaster_user_name as string) || user;
      const viewers = event.viewers as number | undefined;
      push({ platform: "twitch", kind: "raid", user: raider, message: `is raiding with ${viewers ?? "some"} viewers!`, amount: viewers !== undefined ? String(viewers) : undefined });
      break;
    }
    case "channel.cheer": {
      const bits = event.bits as number | undefined;
      const cheerer = event.is_anonymous ? "An anonymous cheerer" : user;
      push({ platform: "twitch", kind: "cheer", user: cheerer, message: `cheered ${bits ?? "some"} bits!`, amount: bits !== undefined ? String(bits) : undefined });
      break;
    }
    default:
      break;
  }
}

function formatTier(tier: unknown): string {
  if (tier === "1000") return "1";
  if (tier === "2000") return "2";
  if (tier === "3000") return "3";
  return String(tier ?? "1");
}
