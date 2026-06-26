import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, ChatChannel, Platform, ChatUser } from "@/types";

// ─── Fake data pools ──────────────────────────────────────────

const twitchUsers: ChatUser[] = [
  { id: "t1", username: "xqc", displayName: "xQc", color: "#FF6B6B", badges: [{ text: "mod", type: "moderator" }] },
  { id: "t2", username: "pokimane", displayName: "Pokimane", color: "#9146FF", badges: [{ text: "vip", type: "vip" }, { text: "sub", type: "subscriber", count: 24 }] },
  { id: "t3", username: "shroud", displayName: "shroud", color: "#4ECDC4", badges: [{ text: "sub", type: "subscriber", count: 12 }] },
  { id: "t4", username: "hasanabi", displayName: "HasanAbi", color: "#45B7D1", badges: [{ text: "mod", type: "moderator" }] },
  { id: "t5", username: "lirik", displayName: "LIRIK", color: "#FFEAA7", badges: [] },
  { id: "t6", username: "summit1g", displayName: "summit1g", color: "#DDA0DD", badges: [{ text: "vip", type: "vip" }] },
  { id: "t7", username: "timthetatman", displayName: "TimTheTatman", color: "#98D8C8", badges: [{ text: "sub", type: "subscriber", count: 6 }] },
  { id: "t8", username: "nickmercs", displayName: "NICKMERCS", color: "#F7DC6F", badges: [{ text: "mod", type: "moderator" }, { text: "sub", type: "subscriber", count: 36 }] },
  { id: "t9", username: "drdisrespect", displayName: "DrDisrespect", color: "#BB8FCE", badges: [{ text: "vip", type: "vip" }] },
  { id: "t10", username: "cohhcarnage", displayName: "CohhCarnage", color: "#85C1E9", badges: [] },
  { id: "t11", username: "chat_spammer42", displayName: "ChatSpammer42", color: "#F8C471", badges: [] },
  { id: "t12", username: "nightbot", displayName: "Nightbot", color: "#3b82f6", badges: [{ text: "bot", type: "bot" }] },
];

const kickUsers: ChatUser[] = [
  { id: "k1", username: "kickmod_alpha", displayName: "KickMod_Alpha", color: "#53fc18", badges: [{ text: "mod", type: "moderator" }] },
  { id: "k2", username: "streamfan99", displayName: "StreamFan99", color: "#FF6B6B", badges: [{ text: "sub", type: "subscriber", count: 3 }] },
  { id: "k3", username: "gamer_dude", displayName: "Gamer_Dude", color: "#4ECDC4", badges: [] },
  { id: "k4", username: "hype_train_go", displayName: "HypeTrainGo", color: "#9146FF", badges: [{ text: "sub", type: "subscriber", count: 8 }] },
  { id: "k5", username: "lurker_404", displayName: "Lurker404", color: "#8888a0", badges: [] },
  { id: "k6", username: "donator_pro", displayName: "DonatorPro", color: "#FFEAA7", badges: [{ text: "sub_gifter", type: "sub_gifter", count: 15 }] },
  { id: "k7", username: "clip_king", displayName: "ClipKing", color: "#F7DC6F", badges: [{ text: "mod", type: "moderator" }] },
  { id: "k8", username: "new_viewer_", displayName: "New_Viewer_", color: "#82E0AA", badges: [] },
];

const joystickUsers: ChatUser[] = [
  { id: "j1", username: "joystick_pro", displayName: "JoystickPro", color: "#ff6b35", badges: [{ text: "mod", type: "moderator" }] },
  { id: "j2", username: "retro_gamer", displayName: "RetroGamer", color: "#FF6B6B", badges: [] },
  { id: "j3", username: "speedrunner_x", displayName: "SpeedrunnerX", color: "#4ECDC4", badges: [{ text: "vip", type: "vip" }] },
  { id: "j4", username: "casual_watcher", displayName: "CasualWatcher", color: "#DDA0DD", badges: [] },
  { id: "j5", username: "boss_fight_99", displayName: "BossFight99", color: "#BB8FCE", badges: [{ text: "sub", type: "subscriber", count: 2 }] },
];

const twitchMessages = [
  "LET'S GOOO 🔥🔥🔥",
  "PogChamp PogChamp PogChamp",
  "KEKW that was hilarious",
  "monkaS monkaS monkaS",
  "Can we get some hype in chat??",
  "GG well played",
  "LULW",
  "Sadge",
  "widepeepoHappy",
  "This stream is so good",
  "First time here, love the content!",
  "HeyGuys",
  "VoHiYo",
  "Can you play my song request?",
  "modCheck",
  "catJAM",
  "pepeLaugh",
  "OMEGALUL",
  "EZ Clap",
  "Pog",
  "FeelsStrongMan",
  "Copium",
  "Based",
  "No way that just happened 💀",
  "Chat is moving so fast I can't keep up",
  "HYPERS",
  "SHEEEESH",
  "bruh moment",
  "this is so cursed",
  "W stream",
  "L take",
];

const kickMessages = [
  "LET'S GOOO",
  "This is fire 🔥",
  "First time on Kick, love it here",
  "Better than Twitch ngl",
  "GG!",
  "Hype hype hype!",
  "Can someone clip that?",
  "LFG!!!!",
  "This chat is so chill",
  "Just subbed! 🎉",
  "Who else is watching at 3am?",
  "POGGERS",
  "KEKW",
  "monkaW",
  "EZ",
  "W content",
  "This streamer is underrated",
  "Chat let's gooooo",
  "Can we get 100 viewers?",
  "Dropped a follow, great stream!",
];

const joystickMessages = [
  "Nice play!",
  "How did you do that combo?",
  "This game is so good",
  "GG WP",
  "Let's gooo",
  "That was insane",
  "Can you try a no-hit run?",
  "First time watching, this is awesome",
  "The vibes here are great",
  "Who else loves retro games?",
  "Speedrun any% when?",
  "This boss is brutal",
  "Clutch!!!",
  "No way 🤯",
  "Great stream as always",
];

const userPool: Record<Platform, ChatUser[]> = {
  twitch: twitchUsers,
  kick: kickUsers,
  joystick: joystickUsers,
};

const messagePool: Record<Platform, string[]> = {
  twitch: twitchMessages,
  kick: kickMessages,
  joystick: joystickMessages,
};

// ─── Dummy channels ───────────────────────────────────────────

const dummyChannels: ChatChannel[] = [
  { platform: "twitch", channelId: "xqc", channelName: "xQc", isConnected: true, isLive: true, viewerCount: 45200, connectionMode: "api" },
  { platform: "twitch", channelId: "pokimane", channelName: "Pokimane", isConnected: true, isLive: true, viewerCount: 12800, connectionMode: "api" },
  { platform: "kick", channelId: "kickstreamer", channelName: "KickStreamer", isConnected: true, isLive: true, viewerCount: 3400, connectionMode: "api" },
  { platform: "joystick", channelId: "retro_gaming", channelName: "RetroGaming", isConnected: true, isLive: false, viewerCount: 0, connectionMode: "ws" },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useDummyData() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels] = useState<ChatChannel[]>(dummyChannels);
  const [activeChannel, setActiveChannel] = useState<string | null>("twitch:xqc");
  const [isMultiChat, setIsMultiChat] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate a single fake message
  const spawnMessage = useCallback(() => {
    const platform = pick<Platform>(["twitch", "twitch", "twitch", "kick", "kick", "joystick"]);
    const user = pick(userPool[platform]);
    const content = pick(messagePool[platform]);

    const msg: ChatMessage = {
      id: generateId(),
      platform,
      user: { ...user, id: `${user.id}-${generateId()}` },
      content,
      timestamp: Date.now(),
      isDeleted: false,
    };

    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  // Start the fake chat feed
  useEffect(() => {
    // Seed some initial messages
    const seed: ChatMessage[] = [];
    for (let i = 0; i < 15; i++) {
      const platform = pick<Platform>(["twitch", "twitch", "kick", "joystick"]);
      const user = pick(userPool[platform]);
      const content = pick(messagePool[platform]);
      seed.push({
        id: generateId(),
        platform,
        user: { ...user, id: `seed-${i}` },
        content,
        timestamp: Date.now() - (15 - i) * 2000,
        isDeleted: false,
      });
    }
    setMessages(seed);

    // Spawn new messages at random intervals
    intervalRef.current = setInterval(() => {
      spawnMessage();
      // Occasionally spawn bursts
      if (Math.random() > 0.7) {
        setTimeout(spawnMessage, 300);
      }
      if (Math.random() > 0.9) {
        setTimeout(spawnMessage, 600);
      }
    }, 1200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spawnMessage]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    channels,
    activeChannel,
    setActiveChannel,
    isMultiChat,
    setIsMultiChat,
    clearMessages,
    // No-ops for actions that don't apply to dummy data
    connectChannel: (_p: unknown, _c: unknown, _n: unknown) => {},
    disconnectChannel: (_p: unknown, _c: unknown) => {},
    sendMessage: (_p: unknown, _c: unknown, _m: unknown) => {},
    isConnecting: false,
    setChannelConnectionMode: () => {},
  };
}
