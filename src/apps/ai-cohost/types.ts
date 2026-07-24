// Grounded in Hugging Face's current free-tier offering (huggingface.co/docs/
// inference-providers): the Serverless Inference API's free tier covers
// models under ~10B params with rate limits (a few hundred requests/hour) —
// fine for a co-host that only replies on specific triggers, not every
// message. The curated list below are commonly available Instruct-tuned
// chat models under that size on the free tier as of this writing; exact
// availability can shift, hence a picker rather than a hardcoded choice.

export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct", note: "Meta — well-rounded, widely available" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct", note: "Fast, low latency" },
  { id: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B Instruct", note: "Strong instruction-following" },
  { id: "google/gemma-2-9b-it", label: "Gemma 2 9B", note: "Google — good safety tuning out of the box" },
  { id: "microsoft/Phi-3.5-mini-instruct", label: "Phi-3.5 Mini", note: "Smallest/fastest of the set" },
  { id: "HuggingFaceH4/zephyr-7b-beta", label: "Zephyr 7B Beta", note: "Hugging Face's own chat fine-tune" },
];

export type TriggerType = "mention" | "command" | "follow" | "sub" | "raid" | "cheer";

export const TRIGGER_LABELS: { key: TriggerType; label: string; hint: string }[] = [
  { key: "mention", label: "@mentions", hint: "Replies when someone @-tags the bot's name" },
  { key: "command", label: "!ask command", hint: "Replies only to a dedicated command, not free chat" },
  { key: "follow", label: "New follows", hint: "Reacts to Alerts Hub follow events" },
  { key: "sub", label: "New subs", hint: "Reacts to Alerts Hub sub events" },
  { key: "raid", label: "Incoming raids", hint: "Reacts to Alerts Hub raid events" },
  { key: "cheer", label: "Cheers/tips", hint: "Reacts to Alerts Hub cheer/tip events" },
];

export interface CoHostPlatforms {
  twitch: boolean;
  kick: boolean;
  joystick: boolean;
  streamerbot: boolean;
}

/** What the co-host is allowed to act on, not just talk about — each maps to
 * a real existing tool in this app, not a hypothetical one. Nothing here is
 * wired to actually invoke anything yet (same "preview" scope as the rest
 * of this tool); it's the permission surface for when it is. */
export type ToolAccess =
  | "soundboard"
  | "sceneSwitcher"
  | "streamTimer"
  | "streamManager"
  | "alertsHub"
  | "chatbotCommands"
  | "notesCommands"
  | "streamStats";

export const TOOL_ACCESS_OPTIONS: { key: ToolAccess; label: string; hint: string; risk: "low" | "medium" }[] = [
  { key: "soundboard", label: "Sound Board", hint: "Trigger a sound clip by name", risk: "low" },
  { key: "chatbotCommands", label: "Chatbot Commands", hint: "Run one of this app's own custom commands", risk: "low" },
  { key: "notesCommands", label: "Notes & Commands", hint: "Read stream notes and command reference for context", risk: "low" },
  { key: "streamStats", label: "Stream Stats", hint: "Read current viewer count, uptime, category for context", risk: "low" },
  { key: "streamTimer", label: "Stream Timer", hint: "Start/stop/read the stream timer", risk: "medium" },
  { key: "sceneSwitcher", label: "Scene Switcher", hint: "Change the active OBS/Meld scene", risk: "medium" },
  { key: "alertsHub", label: "Alerts Hub", hint: "Read recent follow/sub/raid/tip events for context", risk: "medium" },
  { key: "streamManager", label: "Stream Manager", hint: "Update stream title/category", risk: "medium" },
];

export interface Guardrails {
  /** Freeform, comma-separated — not a real filter yet, just documents intent for when this goes live. */
  bannedTopics: string;
  maxResponseLength: number;
  requireApproval: boolean;
  profanityFilter: boolean;
  /** Seconds between responses, global — separate from any per-command cooldown in Chatbot. */
  cooldownSeconds: number;
}

export interface CoHostConfig {
  enabled: boolean;
  name: string;
  avatar: string;
  persona: string;
  model: string;
  triggers: Record<TriggerType, boolean>;
  platforms: CoHostPlatforms;
  guardrails: Guardrails;
  tools: Record<ToolAccess, boolean>;
}
