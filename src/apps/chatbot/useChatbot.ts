import { useEffect, useState } from "react";
import type { ChatCommand } from "./types";

const STORAGE_KEY = "bd-chatbot-commands";

const allPlatforms = { twitch: true, kick: true, joystick: true, streamerbot: false };

const defaultCommands: ChatCommand[] = [
  {
    id: "socials",
    trigger: "!socials",
    aliases: ["!social"],
    matchMode: "start",
    caseSensitive: false,
    response: "Follow along: twitter.com/yourhandle · instagram.com/yourhandle",
    platforms: allPlatforms,
    permission: "everyone",
    cooldownGlobal: 10,
    cooldownPerUser: 0,
    enabled: true,
    useCount: 0,
  },
  {
    id: "discord",
    trigger: "!discord",
    aliases: [],
    matchMode: "start",
    caseSensitive: false,
    response: "Join the Discord: discord.gg/yourserver",
    platforms: allPlatforms,
    permission: "everyone",
    cooldownGlobal: 10,
    cooldownPerUser: 0,
    enabled: true,
    useCount: 0,
  },
  {
    id: "uptime",
    trigger: "!uptime",
    aliases: [],
    matchMode: "start",
    caseSensitive: false,
    response: "Stream has been live for {uptime}",
    platforms: allPlatforms,
    permission: "everyone",
    cooldownGlobal: 5,
    cooldownPerUser: 0,
    enabled: true,
    useCount: 0,
  },
  // No !so/!shoutout stub here — Multi-Chat (public/multichat/multichat.js,
  // handleShoutoutCommand/sendShoutout) already owns those triggers with a
  // real, working implementation across every connected platform. Adding a
  // same-named command here — even inert today, since nothing in this app
  // executes yet — would collide the moment this preview (or AI Co-Host's
  // "chatbotCommands" tool access) starts actually running commands.
];

export function useChatbot() {
  const [commands, setCommands] = useState<ChatCommand[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ChatCommand[]) : defaultCommands;
    } catch {
      return defaultCommands;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
  }, [commands]);

  const addCommand = () => {
    const cmd: ChatCommand = {
      id: `${Date.now()}`,
      trigger: "!newcommand",
      aliases: [],
      matchMode: "start",
      caseSensitive: false,
      response: "",
      platforms: allPlatforms,
      permission: "everyone",
      cooldownGlobal: 0,
      cooldownPerUser: 0,
      enabled: true,
      useCount: 0,
    };
    setCommands((prev) => [cmd, ...prev]);
    return cmd.id;
  };

  const updateCommand = (id: string, patch: Partial<ChatCommand>) => {
    setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCommand = (id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  };

  return { commands, addCommand, updateCommand, removeCommand };
}
