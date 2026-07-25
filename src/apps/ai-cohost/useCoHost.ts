import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CoHostConfig, ToolAccess } from "./types";
import { MODEL_OPTIONS } from "./types";

const STORAGE_KEY = "bd-ai-cohost-config";

const defaultConfig: CoHostConfig = {
  enabled: false,
  name: "Co-Host",
  avatar: "🤖",
  persona:
    "You're a laid-back, funny co-host for this stream. Keep replies short (1-2 sentences), " +
    "never reveal you're an AI unless directly asked, and never talk about politics, religion, " +
    "or anything NSFW.",
  model: MODEL_OPTIONS[0]!.id,
  triggers: { mention: true, command: true, follow: false, sub: false, raid: false, cheer: false },
  platforms: { twitch: true, kick: true, joystick: true, streamerbot: false },
  // Low-risk (read-only or self-contained) tools default on; anything that
  // changes stream state (scenes, title/category, timer) defaults off —
  // same cautious-by-default reasoning as requireApproval below.
  tools: {
    soundboard: true,
    chatbotCommands: true,
    notesCommands: true,
    streamStats: true,
    streamTimer: false,
    sceneSwitcher: false,
    alertsHub: false,
    streamManager: false,
  },
  guardrails: {
    bannedTopics: "politics, religion, NSFW",
    maxResponseLength: 200,
    requireApproval: true,
    profanityFilter: true,
    cooldownSeconds: 30,
  },
};

export function useCoHost() {
  const [config, setConfig] = useState<CoHostConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultConfig, ...(JSON.parse(raw) as CoHostConfig) } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const update = (patch: Partial<CoHostConfig>) => setConfig((prev) => ({ ...prev, ...patch }));
  const updateGuardrails = (patch: Partial<CoHostConfig["guardrails"]>) =>
    setConfig((prev) => ({ ...prev, guardrails: { ...prev.guardrails, ...patch } }));
  const toggleTrigger = (key: keyof CoHostConfig["triggers"]) =>
    setConfig((prev) => ({ ...prev, triggers: { ...prev.triggers, [key]: !prev.triggers[key] } }));
  const togglePlatform = (key: keyof CoHostConfig["platforms"]) =>
    setConfig((prev) => ({ ...prev, platforms: { ...prev.platforms, [key]: !prev.platforms[key] } }));
  const toggleTool = (key: ToolAccess) =>
    setConfig((prev) => ({ ...prev, tools: { ...prev.tools, [key]: !prev.tools[key] } }));

  /** Calls Hugging Face's Inference Providers router directly from the Rust
   * backend (cohost.rs) — no local runtime, no separate app to install. */
  const generateReply = (message: string): Promise<string> =>
    invoke<string>("cohost_generate_reply", {
      message,
      persona: config.persona,
      model: config.model,
      bannedTopics: config.guardrails.bannedTopics,
      maxResponseLength: config.guardrails.maxResponseLength,
    });

  return { config, update, updateGuardrails, toggleTrigger, togglePlatform, toggleTool, generateReply };
}
