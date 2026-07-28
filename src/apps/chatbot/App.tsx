import { useEffect, useState } from "react";
import "../../design-system/styles.css";
import { Badge, Button, Card, Chip, SectionHead, StatusDot } from "../../design-system/components/core";
import { EmptyState } from "../../design-system/components/feedback";
import { fetchConfig } from "@statusforge/hooks/useTauriApi";
import type { AppConfig } from "@statusforge/types";
import { useChatbot } from "./useChatbot";
import type { ChatCommand, MatchMode, Permission } from "./types";

const MATCH_MODES: { value: MatchMode; label: string }[] = [
  { value: "start", label: "Starts with" },
  { value: "exact", label: "Exact match" },
  { value: "anywhere", label: "Anywhere in message" },
  { value: "regex", label: "Regex" },
];

const PERMISSIONS: { value: Permission; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "subscriber", label: "Subscriber" },
  { value: "vip", label: "VIP" },
  { value: "moderator", label: "Moderator" },
  { value: "broadcaster", label: "Broadcaster only" },
];

const PLATFORM_LABELS: { key: keyof ChatCommand["platforms"]; label: string; icon: string }[] = [
  { key: "twitch", label: "Twitch", icon: "🟣" },
  { key: "kick", label: "Kick", icon: "🟢" },
  { key: "joystick", label: "Joystick.tv", icon: "🕹️" },
  { key: "streamerbot", label: "via Streamer.bot", icon: "🤖" },
];

/** Real readout (not mocked) — same "connected via Connections & Keys"
 * pattern used everywhere else this app centralizes a connection. Whether
 * the bot can actually run on a platform depends on this, so it's worth
 * showing honestly even though command execution itself isn't wired up yet. */
function ConnectionStatus({ config, adultContentEnabled }: { config: AppConfig | null; adultContentEnabled: boolean }) {
  const bc = config?.broadcaster;
  const rows = [
    { key: "twitch", label: "Twitch", connected: !!(bc?.twitch_token && bc?.twitch_client) },
    { key: "kick", label: "Kick", connected: !!(bc?.kick_token && bc?.kick_client) },
    ...(adultContentEnabled
      ? [{ key: "joystick", label: "Joystick.tv", connected: !!(bc?.joystick_refresh && bc?.joystick_client) }]
      : []),
    { key: "streamerbot", label: "Streamer.bot", connected: !!(bc?.streamerbot_host && bc?.streamerbot_port) },
  ];

  return (
    <Card padding={16} className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
          Platform Connections
        </span>
        <span className="text-[10px] text-white/25">Set up in Settings → Connections & Keys</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
            <span className="text-[12px] text-white/60">{r.label}</span>
            <StatusDot status={r.connected ? "on" : "off"} label={r.connected ? "Connected" : "Not connected"} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function CommandEditor({
  cmd,
  onChange,
  onDelete,
  adultContentEnabled,
}: {
  cmd: ChatCommand;
  onChange: (patch: Partial<ChatCommand>) => void;
  onDelete: () => void;
  adultContentEnabled: boolean;
}) {
  const [aliasInput, setAliasInput] = useState(cmd.aliases.join(", "));
  const platformOptions = PLATFORM_LABELS.filter((p) => p.key !== "joystick" || adultContentEnabled);

  return (
    <Card padding={16} className={`transition-all ${cmd.enabled ? "" : "opacity-50"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <input
          value={cmd.trigger}
          onChange={(e) => onChange({ trigger: e.target.value })}
          className="input-glass font-mono text-[13px] font-semibold flex-1"
          placeholder="!command"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onChange({ enabled: !cmd.enabled })}>
            <Badge variant={cmd.enabled ? "green" : "ghost"}>{cmd.enabled ? "ON" : "OFF"}</Badge>
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 flex items-center justify-center rounded text-red-400/40 hover:text-red-400/80 text-xs transition-all"
          >
            ✕
          </button>
        </div>
      </div>

      <textarea
        value={cmd.response}
        onChange={(e) => onChange({ response: e.target.value })}
        placeholder="Response text — {arg1}, {arg2}… and {uptime} are placeholders, not wired up yet"
        rows={2}
        className="input-glass w-full text-[12px] mb-3 resize-none"
      />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Aliases</label>
          <input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onBlur={() =>
              onChange({
                aliases: aliasInput
                  .split(",")
                  .map((a) => a.trim())
                  .filter(Boolean),
              })
            }
            placeholder="!alt1, !alt2"
            className="input-glass w-full text-[11px]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Match</label>
          <select
            value={cmd.matchMode}
            onChange={(e) => onChange({ matchMode: e.target.value as MatchMode })}
            className="input-glass w-full text-[11px]"
          >
            {MATCH_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Permission</label>
          <select
            value={cmd.permission}
            onChange={(e) => onChange({ permission: e.target.value as Permission })}
            className="input-glass w-full text-[11px]"
          >
            {PERMISSIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-[9px] text-white/20 mt-1">Broadcaster is always exempt from cooldowns.</p>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
            Global Cooldown (s)
          </label>
          <input
            type="number"
            min={0}
            value={cmd.cooldownGlobal}
            onChange={(e) => onChange({ cooldownGlobal: Math.max(0, Number(e.target.value) || 0) })}
            className="input-glass w-full text-[11px]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
            Per-User Cooldown (s)
          </label>
          <input
            type="number"
            min={0}
            value={cmd.cooldownPerUser}
            onChange={(e) => onChange({ cooldownPerUser: Math.max(0, Number(e.target.value) || 0) })}
            className="input-glass w-full text-[11px]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {platformOptions.map((p) => (
            <Chip
              key={p.key}
              selected={cmd.platforms[p.key]}
              onClick={() => onChange({ platforms: { ...cmd.platforms, [p.key]: !cmd.platforms[p.key] } })}
            >
              {p.icon} {p.label}
            </Chip>
          ))}
        </div>
        <span className="text-[9px] text-white/15 shrink-0 ml-2">used {cmd.useCount}×</span>
      </div>
    </Card>
  );
}

export default function ChatbotApp() {
  const { commands, addCommand, updateCommand, removeCommand } = useChatbot();
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetchConfig().then(setAppConfig);
  }, []);

  // Off by default (General -> Adult Content & Platforms) — Joystick.tv
  // stays out of every platform picker/status readout in this tool until
  // it's explicitly turned on there.
  const adultContentEnabled = appConfig?.engine_settings.adult_content_enabled ?? false;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-2">
          <SectionHead
            icon="🤖"
            title="Chatbot"
            desc="Custom commands across every platform this app connects to"
            right={
              <Button variant="cta" onClick={addCommand}>
                + New Command
              </Button>
            }
          />
        </div>

        <div className="mb-6 px-4 py-3 rounded-lg bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_10%,transparent)] border border-[color-mix(in_srgb,var(--user-accent,#9146ff)_20%,transparent)]">
          <p className="text-[11px] text-white/60">
            <b>Preview.</b> Commands here are saved and editable, but nothing runs live in chat yet — this
            is UI only, not a working bot. Sending/moderation still happens through Multi-Chat and Alerts
            Hub in the meantime.
          </p>
        </div>

        <ConnectionStatus config={appConfig} adultContentEnabled={adultContentEnabled} />

        <div className="flex flex-col gap-3">
          {commands.length === 0 ? (
            <Card padding={0}>
              <EmptyState
                icon="🤖"
                title="No commands yet"
                description="Add a command to get started — triggers, responses, cooldowns, and per-platform targeting all live here."
                action={
                  <Button variant="cta" size="sm" onClick={addCommand}>
                    + New Command
                  </Button>
                }
              />
            </Card>
          ) : (
            commands.map((cmd) => (
              <CommandEditor
                key={cmd.id}
                cmd={cmd}
                onChange={(patch) => updateCommand(cmd.id, patch)}
                onDelete={() => removeCommand(cmd.id)}
                adultContentEnabled={adultContentEnabled}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
