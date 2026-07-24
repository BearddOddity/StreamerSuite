// Field shapes grounded in the actual platform docs, not guessed at:
// - Twitch: dev.twitch.tv/docs/chat/chatbot-guide (channel:bot scope,
//   chat:read/chat:edit, mod-only commands like /timeout and /ban need
//   moderator privileges, 20 msg/30s non-mod vs 100 msg/30s mod/broadcaster)
// - Kick: docs.kick.com (chat:write to send, moderation:ban +
//   moderation:chat_message:manage for mod actions — same scopes this app
//   already requests via Connections & Keys)
// - Joystick.tv: github.com/joysticktv/jtv (identity:read chat:read
//   chat:write chat:moderate — see auth.rs/multichat.rs's own scope list)
// - Streamer.bot: docs.streamer.bot/guide/core/commands (match mode,
//   aliases, global + per-user cooldown with broadcaster exemption,
//   allow/deny permission groups, case sensitivity, counter persistence)

export type MatchMode = "start" | "exact" | "anywhere" | "regex";

export type Permission = "everyone" | "subscriber" | "vip" | "moderator" | "broadcaster";

export interface CommandPlatforms {
  twitch: boolean;
  kick: boolean;
  joystick: boolean;
  streamerbot: boolean;
}

export interface ChatCommand {
  id: string;
  trigger: string;
  /** Extra trigger strings — cooldown/use-count are shared across all of a
   * command's aliases, same as Streamer.bot's own model. */
  aliases: string[];
  matchMode: MatchMode;
  caseSensitive: boolean;
  response: string;
  platforms: CommandPlatforms;
  permission: Permission;
  /** Seconds. 0 = no cooldown. Broadcaster is always exempt, matching every
   * platform's own moderator/broadcaster carve-out. */
  cooldownGlobal: number;
  cooldownPerUser: number;
  enabled: boolean;
  useCount: number;
}
