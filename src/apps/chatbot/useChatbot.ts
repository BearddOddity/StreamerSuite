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
  {
    id: "so",
    trigger: "!so",
    aliases: ["!shoutout"],
    matchMode: "start",
    caseSensitive: false,
    response: "Go check out {arg1} — they were awesome! twitch.tv/{arg1}",
    // Twitch has its own native /shoutout; this custom command is the
    // Kick/Joystick equivalent since neither platform has one built in.
    platforms: { twitch: false, kick: true, joystick: true, streamerbot: false },
    permission: "moderator",
    cooldownGlobal: 0,
    cooldownPerUser: 0,
    enabled: true,
    useCount: 0,
  },
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
