import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, ChatChannel, Platform, ChatUser, ConnectionMode } from "@/types";
import type { KickChatMessage, KickChannel } from "../../../Beards Researcher/shared/kick-mcp/types.js";

// Kick's v2 API returns chatroom but it's not in the shared type yet
type KickChannelWithChatroom = KickChannel & {
  chatroom?: { id: number; [key: string]: unknown };
};

const MAX_MESSAGES = 500;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSystemMessage(platform: Platform, _channelName: string, event: string): ChatMessage {
  return {
    id: generateId(),
    platform,
    user: {
      id: "system",
      username: "system",
      displayName: "System",
      color: "#8888a0",
      badges: [],
    },
    content: event,
    timestamp: Date.now(),
    isDeleted: false,
  };
}

function randomColor(): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
    "#F8C471", "#82E0AA", "#F1948A", "#AED6F1", "#D7BDE2",
  ];
  return colors[Math.floor(Math.random() * colors.length)] ?? "#e4e4ef";
}

function parseTwitchTags(tagStr: string): Record<string, string> {
  const tags: Record<string, string> = {};
  if (!tagStr.startsWith("@")) return tags;
  const parts = tagStr.slice(1).split(";");
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    tags[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
  }
  return tags;
}

// ─── Helpers to track active connections (WS or API polling) ───

interface ConnectionHandle {
  close: () => void;
  readyState: number;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMultiChat, setIsMultiChat] = useState(false);
  const connRefs = useRef<Map<string, ConnectionHandle>>(new Map());

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, []);

  const setChannelConnected = useCallback((wsKey: string, connected: boolean) => {
    setChannels((prev) =>
      prev.map((c) =>
        `${c.platform}:${c.channelId}` === wsKey
          ? { ...c, isConnected: connected, isLive: connected }
          : c
      )
    );
  }, []);

  const setChannelConnectionMode = useCallback((platform: Platform, channelId: string, mode: ConnectionMode) => {
    const wsKey = `${platform}:${channelId}`;
    setChannels((prev) =>
      prev.map((c) =>
        `${c.platform}:${c.channelId}` === wsKey
          ? { ...c, connectionMode: mode }
          : c
      )
    );
  }, []);

  const connectChannel = useCallback(
    async (platform: Platform, channelId: string, channelName: string) => {
      const wsKey = `${platform}:${channelId}`;
      if (connRefs.current.has(wsKey)) return;

      setIsConnecting(true);

      const channel: ChatChannel = {
        platform,
        channelId,
        channelName,
        isConnected: false,
        isLive: false,
        connectionMode: "api",
      };

      setChannels((prev) => {
        if (prev.some((c) => `${c.platform}:${c.channelId}` === wsKey)) return prev;
        return [...prev, channel];
      });

      // Try API first, fall back to WS
      let connected = false;

      if (platform === "twitch") {
        connected = await connectTwitchApi(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        if (!connected) {
          setChannelConnectionMode(platform, channelId, "ws");
          connectTwitchWs(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        }
      } else if (platform === "kick") {
        connected = await connectKickApi(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        if (!connected) {
          setChannelConnectionMode(platform, channelId, "ws");
          connectKickWs(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        }
      } else if (platform === "joystick") {
        connected = await connectJoystickApi(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        if (!connected) {
          setChannelConnectionMode(platform, channelId, "ws");
          connectJoystickWs(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        }
      }

      if (!connected) {
        addMessage(createSystemMessage(platform, channelName, "Connecting..."));
      }

      setIsConnecting(false);
    },
    [addMessage]
  );

  const disconnectChannel = useCallback(
    (platform: Platform, channelId: string) => {
      const wsKey = `${platform}:${channelId}`;
      const conn = connRefs.current.get(wsKey);
      if (conn) {
        conn.close();
        connRefs.current.delete(wsKey);
      }
      setChannels((prev) => prev.filter((c) => `${c.platform}:${c.channelId}` !== wsKey));
      if (activeChannel === wsKey) setActiveChannel(null);
    },
    [activeChannel]
  );

  const sendMessage = useCallback(
    (platform: Platform, channelId: string, content: string) => {
      const wsKey = `${platform}:${channelId}`;
      const conn = connRefs.current.get(wsKey);
      if (!conn || conn.readyState !== WebSocket.OPEN) return;

      if (platform === "twitch") {
        connRefs.current.get(wsKey)?.close(); // can't send via API-only
      }
      // WS send — only works for WS connections
      if (conn instanceof WebSocket) {
        if (platform === "twitch") {
          conn.send(`PRIVMSG #${channelId.toLowerCase()} :${content}`);
        } else {
          conn.send(JSON.stringify({ content }));
        }
      }
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      connRefs.current.forEach((conn) => conn.close());
      connRefs.current.clear();
    };
  }, []);

  return {
    messages,
    channels,
    activeChannel,
    isConnecting,
    isMultiChat,
    setActiveChannel,
    setIsMultiChat,
    connectChannel,
    disconnectChannel,
    sendMessage,
    clearMessages,
    setChannelConnectionMode,
  };
}

// ═══════════════════════════════════════════════════════════════
//  API Connectors (preferred)
// ═══════════════════════════════════════════════════════════════

async function connectTwitchApi(
  _channelId: string,
  _addMessage: (msg: ChatMessage) => void,
  _connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  _wsKey: string,
  _setChannelConnected: (key: string, connected: boolean) => void
): Promise<boolean> {
  // Use Twitch's public IRC-over-WebSocket is the only real-time option,
  // but we can use the Helix API for recent chat data as a supplement.
  // For live chat, we still need WS — so mark as WS fallback.
  return false;
}

async function connectKickApi(
  channelId: string,
  addMessage: (msg: ChatMessage) => void,
  connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  wsKey: string,
  setChannelConnected: (key: string, connected: boolean) => void
): Promise<boolean> {
  try {
    const chanRes = await fetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(channelId.toLowerCase())}`
    );
    if (!chanRes.ok) return false;
    const chanData = (await chanRes.json()) as KickChannelWithChatroom;
    const chatroomId = chanData?.chatroom?.id;
    if (!chatroomId) return false;

    setChannelConnected(wsKey, true);
    addMessage(createSystemMessage("kick", channelId, "Connected via API (polling)"));

    const abort = new AbortController();
    let lastMessageId = "";

    async function poll() {
      while (!abort.signal.aborted) {
        try {
          const res = await fetch(
            `https://kick.com/api/v2/channels/${encodeURIComponent(channelId.toLowerCase())}/messages`,
            { signal: abort.signal, headers: { Accept: "application/json" } }
          );
          if (res.ok) {
            const data = (await res.json()) as { messages?: KickChatMessage[] };
            const msgs = data?.messages ?? [];
            if (msgs.length > 0 && !lastMessageId) {
              lastMessageId = msgs[0]?.id ?? "";
            }
            for (const msg of msgs) {
              if (msg.id === lastMessageId) break;
              const sender = msg.sender;
              const user: ChatUser = {
                id: String(sender?.id ?? "unknown"),
                username: sender?.username ?? "unknown",
                displayName: sender?.username ?? "unknown",
                color: sender?.color ?? randomColor(),
                badges: (sender?.badges ?? []).map((b) => ({
                  text: b.text,
                  type: b.type,
                  count: b.count,
                })),
              };
              addMessage({
                id: generateId(),
                platform: "kick",
                user,
                content: msg.content ?? "",
                timestamp: new Date(msg.created_at ?? Date.now()).getTime(),
                isDeleted: false,
              });
            }
            if (msgs.length > 0) {
              lastMessageId = msgs[0]?.id ?? lastMessageId;
            }
          }
        } catch {
          // aborted or network
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    poll();

    const handle: ConnectionHandle = {
      close: () => abort.abort(),
      readyState: WebSocket.OPEN,
    };
    connRefs.current?.set(wsKey, handle);
    return true;
  } catch {
    return false;
  }
}

async function connectJoystickApi(
  channelId: string,
  addMessage: (msg: ChatMessage) => void,
  _connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  _wsKey: string,
  _setChannelConnected: (key: string, connected: boolean) => void
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.joysticks.tv/channels/${encodeURIComponent(channelId)}`);
    if (!res.ok) return false;
    const data = await res.json();
    const wsUrl = data?.chat_ws_url ?? data?.websocket_url;
    if (!wsUrl) {
      addMessage(createSystemMessage("joystick", channelId, "JoystickTV chat API not publicly available"));
      return false;
    }
    // Has a WS URL — let the WS connector handle it
    return false;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  WebSocket Connectors (fallback)
// ═══════════════════════════════════════════════════════════════

function connectTwitchWs(
  channelId: string,
  addMessage: (msg: ChatMessage) => void,
  connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  wsKey: string,
  setChannelConnected: (key: string, connected: boolean) => void
) {
  const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  let joined = false;
  const chanLower = channelId.toLowerCase();

  ws.onopen = () => {
    ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
    ws.send("PASS justinfan5321");
    ws.send(`NICK justinfan${Math.floor(Math.random() * 999999)}`);
    ws.send(`JOIN #${chanLower}`);
  };

  ws.onmessage = (event) => {
    const lines = event.data.split("\r\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith("PING")) {
        ws.send("PONG :tmi.twitch.tv");
        continue;
      }
      if (line.includes(" 001 ") && !joined) {
        joined = true;
        setChannelConnected(wsKey, true);
        addMessage(createSystemMessage("twitch", channelId, "Connected via WebSocket"));
        continue;
      }
      const privmatch = line.match(/^@([^ ]+) :([^!]+)![^@]+@[^ ]+ PRIVMSG #([^ ]+) :(.+)$/);
      if (privmatch) {
        const [, tagStr, username, , content] = privmatch;
        const tags = parseTwitchTags(tagStr ?? "");
        const badges = (tags["badges"] ?? "").split(",").filter(Boolean).map((b) => {
          const [type] = b.split("/");
          return { text: type ?? b, type: type ?? "unknown" };
        });
        const user: ChatUser = {
          id: tags["user-id"] ?? username ?? "unknown",
          username: username ?? "unknown",
          displayName: tags["display-name"] ?? username ?? "unknown",
          color: tags["color"] && tags["color"] !== "" ? tags["color"] : randomColor(),
          badges,
        };
        addMessage({
          id: generateId(),
          platform: "twitch",
          user,
          content: content ?? "",
          timestamp: Date.now(),
          isDeleted: false,
        });
      }
    }
  };

  ws.onerror = () => {
    addMessage(createSystemMessage("twitch", channelId, "Connection error"));
    setChannelConnected(wsKey, false);
  };

  ws.onclose = () => {
    addMessage(createSystemMessage("twitch", channelId, "Disconnected"));
    setChannelConnected(wsKey, false);
    connRefs.current?.delete(wsKey);
  };

  connRefs.current?.set(wsKey, ws);
}

function connectKickWs(
  channelId: string,
  addMessage: (msg: ChatMessage) => void,
  connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  wsKey: string,
  setChannelConnected: (key: string, connected: boolean) => void
) {
  const ws = new WebSocket("wss://ws-eu.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false");
  let connected = false;

  ws.onopen = () => {
    fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channelId.toLowerCase())}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const chan = data as KickChannelWithChatroom;
        const chatroomId = chan?.chatroom?.id;
        if (chatroomId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            event: "pusher:subscribe",
            data: { channel: `private-chatroom-${chatroomId}` },
          }));
          connected = true;
          setChannelConnected(wsKey, true);
          addMessage(createSystemMessage("kick", channelId, "Connected via WebSocket"));
        } else {
          addMessage(createSystemMessage("kick", channelId, "Could not resolve channel — trying polling fallback"));
          ws.close();
          startKickPollingFallback(channelId, addMessage, connRefs, wsKey, setChannelConnected);
        }
      })
      .catch(() => {
        ws.close();
        startKickPollingFallback(channelId, addMessage, connRefs, wsKey, setChannelConnected);
      });
  };

  ws.onmessage = (event) => {
    try {
      const frame = JSON.parse(event.data);
      if (frame.event === "App\Events\ChatMessageEvent") {
        const msg = JSON.parse(frame.data) as KickChatMessage;
        const sender = msg.sender;
        const user: ChatUser = {
          id: String(sender?.id ?? "unknown"),
          username: sender?.username ?? "unknown",
          displayName: sender?.username ?? "unknown",
          color: sender?.color ?? randomColor(),
          badges: (sender?.badges ?? []).map((b) => ({
            text: b.text,
            type: b.type,
            count: b.count,
          })),
        };
        addMessage({
          id: generateId(),
          platform: "kick",
          user,
          content: msg.content ?? "",
          timestamp: Date.now(),
          isDeleted: false,
        });
      }
    } catch {
      // skip
    }
  };

  connRefs.current?.set(wsKey, ws);
}

function startKickPollingFallback(
  channelId: string,
  addMessage: (msg: ChatMessage) => void,
  connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  wsKey: string,
  setChannelConnected: (key: string, connected: boolean) => void
) {
  let lastMessageId = "";
  const abort = new AbortController();

  async function poll() {
    while (!abort.signal.aborted) {
      try {
        const res = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(channelId.toLowerCase())}/messages`,
          { signal: abort.signal, headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          const msgs = data?.data?.messages ?? data?.messages ?? [];
          if (!lastMessageId && msgs.length > 0) {
            lastMessageId = msgs[0]?.id ?? "";
            setChannelConnected(wsKey, true);
            addMessage(createSystemMessage("kick", channelId, "Connected (polling fallback)"));
          }
          for (const msg of msgs) {
            if (msg.id === lastMessageId) break;
            const user: ChatUser = {
              id: String(msg.sender?.id ?? "unknown"),
              username: msg.sender?.username ?? "unknown",
              displayName: msg.sender?.username ?? "unknown",
              color: msg.sender?.identity?.color ?? randomColor(),
              badges: (msg.sender?.identity?.badges ?? []).map((b: { text: string; type: string }) => ({
                text: b.text,
                type: b.type,
              })),
            };
            addMessage({
              id: generateId(),
              platform: "kick",
              user,
              content: msg.content ?? "",
              timestamp: new Date(msg.created_at ?? Date.now()).getTime(),
              isDeleted: false,
            });
          }
          if (msgs.length > 0) {
            lastMessageId = msgs[0]?.id ?? lastMessageId;
          }
        }
      } catch {
        // aborted or network
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  poll();

  const handle: ConnectionHandle = {
    close: () => abort.abort(),
    readyState: WebSocket.OPEN,
  };
  connRefs.current?.set(wsKey, handle);
}

function connectJoystickWs(
  channelId: string,
  addMessage: (msg: ChatMessage) => void,
  connRefs: React.RefObject<Map<string, ConnectionHandle>>,
  wsKey: string,
  setChannelConnected: (key: string, connected: boolean) => void
) {
  addMessage(createSystemMessage("joystick", channelId, "Looking up chat endpoint..."));

  fetch(`https://api.joysticks.tv/channels/${encodeURIComponent(channelId)}`)
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      const wsUrl = data?.chat_ws_url ?? data?.websocket_url;
      if (!wsUrl) {
        addMessage(createSystemMessage("joystick", channelId, "JoystickTV chat API not publicly available — channel added for display only"));
        return;
      }
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setChannelConnected(wsKey, true);
        addMessage(createSystemMessage("joystick", channelId, "Connected via WebSocket"));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const user: ChatUser = {
            id: String(data.user_id ?? data.username ?? "unknown"),
            username: data.username ?? "unknown",
            displayName: data.display_name ?? data.username ?? "unknown",
            color: data.color ?? randomColor(),
            badges: [],
          };
          addMessage({
            id: generateId(),
            platform: "joystick",
            user,
            content: data.message ?? data.content ?? "",
            timestamp: Date.now(),
            isDeleted: false,
          });
        } catch {
          // skip
        }
      };
      ws.onerror = () => {
        addMessage(createSystemMessage("joystick", channelId, "Connection error"));
        setChannelConnected(wsKey, false);
      };
      ws.onclose = () => {
        addMessage(createSystemMessage("joystick", channelId, "Disconnected"));
        setChannelConnected(wsKey, false);
        connRefs.current?.delete(wsKey);
      };
      connRefs.current?.set(wsKey, ws);
    })
    .catch(() => {
      addMessage(createSystemMessage("joystick", channelId, "Failed to look up JoystickTV endpoint"));
    });
}