import { useEffect, useState } from "react";
import "../../design-system/styles.css";
import { Badge, Button, Card, Chip, SectionHead, StatusDot } from "../../design-system/components/core";
import { fetchConfig } from "@statusforge/hooks/useTauriApi";
import type { AppConfig } from "@statusforge/types";
import { useCoHost } from "./useCoHost";
import { MODEL_OPTIONS, UNCENSORED_MODEL_OPTIONS, TRIGGER_LABELS, TOOL_ACCESS_OPTIONS } from "./types";
import type { CoHostPlatforms, TriggerType } from "./types";

const PLATFORM_LABELS: { key: keyof CoHostPlatforms; label: string; icon: string }[] = [
  { key: "twitch", label: "Twitch", icon: "🟣" },
  { key: "kick", label: "Kick", icon: "🟢" },
  { key: "joystick", label: "Joystick.tv", icon: "🕹️" },
  { key: "streamerbot", label: "via Streamer.bot", icon: "🤖" },
];

/** Real readout — same pattern as Chatbot's ConnectionStatus, plus the
 * Hugging Face API token (Connections & Keys → API Keys, not a broadcaster
 * connection) since that's what actually gates whether this could run. */
function ConnectionStatus({ config, adultContentEnabled }: { config: AppConfig | null; adultContentEnabled: boolean }) {
  const bc = config?.broadcaster;
  const rows = [
    { key: "twitch", label: "Twitch", connected: !!(bc?.twitch_token && bc?.twitch_client) },
    { key: "kick", label: "Kick", connected: !!(bc?.kick_token && bc?.kick_client) },
    ...(adultContentEnabled
      ? [{ key: "joystick", label: "Joystick.tv", connected: !!(bc?.joystick_refresh && bc?.joystick_client) }]
      : []),
    { key: "huggingface", label: "Hugging Face", connected: !!config?.api_keys?.huggingface },
  ];

  return (
    <Card padding={16} className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
          Connections
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

export default function CoHostApp() {
  const { config, update, updateGuardrails, toggleTrigger, togglePlatform, toggleTool, generateReply } = useCoHost();
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [tryMessage, setTryMessage] = useState("hey, what game is this?");
  const [tryReply, setTryReply] = useState<string | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);
  const [tryBusy, setTryBusy] = useState(false);

  const runTry = async () => {
    if (!tryMessage.trim() || tryBusy) return;
    setTryBusy(true);
    setTryError(null);
    setTryReply(null);
    try {
      const reply = await generateReply(tryMessage.trim());
      setTryReply(reply);
    } catch (e) {
      setTryError(String(e));
    } finally {
      setTryBusy(false);
    }
  };

  useEffect(() => {
    fetchConfig().then(setAppConfig);
  }, []);

  // Off by default (General -> Adult Content & Platforms) — Joystick.tv
  // stays out of every platform picker/status readout in this tool until
  // it's explicitly turned on there.
  const adultContentEnabled = appConfig?.engine_settings.adult_content_enabled ?? false;
  const platformOptions = PLATFORM_LABELS.filter((p) => p.key !== "joystick" || adultContentEnabled);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-2">
          <SectionHead
            icon={config.avatar || "🤖"}
            title="AI Co-Host"
            desc="A persona-driven chat co-host, powered by a free open model from Hugging Face"
            right={
              <button onClick={() => update({ enabled: !config.enabled })}>
                <Badge variant={config.enabled ? "green" : "ghost"}>{config.enabled ? "ON" : "OFF"}</Badge>
              </button>
            }
          />
        </div>

        <div className="mb-6 px-4 py-3 rounded-lg bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_10%,transparent)] border border-[color-mix(in_srgb,var(--user-accent,#9146ff)_20%,transparent)]">
          <p className="text-[11px] text-white/60">
            <b>Preview.</b> Persona, guardrails, and triggers are saved and editable, and "Try it" below calls
            the real model through your Hugging Face connection — no separate app to install. Automatically
            replying to live chat on the triggers below is the next step once this shape feels right.
          </p>
        </div>

        <ConnectionStatus config={appConfig} adultContentEnabled={adultContentEnabled} />

        {/* Persona */}
        <Card padding={16} className="mb-4">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold block mb-3">
            Persona
          </span>
          <div className="grid grid-cols-[80px_1fr] gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Avatar</label>
              <input
                value={config.avatar}
                onChange={(e) => update({ avatar: e.target.value })}
                className="input-glass w-full text-center text-[18px]"
                maxLength={4}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Name</label>
              <input
                value={config.name}
                onChange={(e) => update({ name: e.target.value })}
                className="input-glass w-full"
              />
            </div>
          </div>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
            Personality (system prompt)
          </label>
          <textarea
            value={config.persona}
            onChange={(e) => update({ persona: e.target.value })}
            rows={4}
            className="input-glass w-full text-[12px] resize-none mb-3"
          />
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">Model</label>
          <select
            value={config.model}
            onChange={(e) => update({ model: e.target.value })}
            className="input-glass w-full text-[12px]"
          >
            <optgroup label="Standard">
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
            </optgroup>
            <optgroup label="Uncensored (relies on your Guardrails below)">
              {UNCENSORED_MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="text-[9px] text-white/20 mt-1">
            Served via Hugging Face's free Serverless Inference API — rate-limited, fine for
            trigger-based replies rather than every chat message. Uncensored models have no built-in
            refusal behavior, so lean on Banned Topics and Mod Approval below to keep them in line.
          </p>
        </Card>

        {/* Try it — a real call to Hugging Face through the Rust backend,
            using the persona/model/guardrails set above. Proves the
            pipeline actually works without needing live chat wired up. */}
        <Card padding={16} className="mb-4">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold block mb-3">
            Try It
          </span>
          <div className="flex gap-2 mb-2">
            <input
              value={tryMessage}
              onChange={(e) => setTryMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runTry()}
              placeholder="Type a chat message to test the persona..."
              className="input-glass flex-1 text-[12px]"
            />
            <Button variant="primary" onClick={runTry} disabled={tryBusy || !tryMessage.trim()}>
              {tryBusy ? "Thinking…" : "Send"}
            </Button>
          </div>
          {tryReply && (
            <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-[12px] text-white/80">
              <span className="mr-1">{config.avatar || "🤖"}</span>
              {tryReply}
            </div>
          )}
          {tryError && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
              {tryError}
            </div>
          )}
        </Card>

        {/* Guardrails */}
        <Card padding={16} className="mb-4">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold block mb-3">
            Guardrails
          </span>
          <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
            Banned topics
          </label>
          <input
            value={config.guardrails.bannedTopics}
            onChange={(e) => updateGuardrails({ bannedTopics: e.target.value })}
            placeholder="politics, religion, NSFW"
            className="input-glass w-full text-[12px] mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
                Max response length
              </label>
              <input
                type="number"
                min={20}
                max={500}
                value={config.guardrails.maxResponseLength}
                onChange={(e) => updateGuardrails({ maxResponseLength: Math.max(20, Number(e.target.value) || 200) })}
                className="input-glass w-full text-[12px]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
                Cooldown (s)
              </label>
              <input
                type="number"
                min={0}
                value={config.guardrails.cooldownSeconds}
                onChange={(e) => updateGuardrails({ cooldownSeconds: Math.max(0, Number(e.target.value) || 0) })}
                className="input-glass w-full text-[12px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
              <div>
                <span className="text-[12px] text-white/70 block">Require mod approval before sending</span>
                <span className="text-[9px] text-white/25">Every reply queues for review, same as Multi-Chat's flagged-message queue</span>
              </div>
              <button onClick={() => updateGuardrails({ requireApproval: !config.guardrails.requireApproval })}>
                <Badge variant={config.guardrails.requireApproval ? "green" : "ghost"}>
                  {config.guardrails.requireApproval ? "ON" : "OFF"}
                </Badge>
              </button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
              <span className="text-[12px] text-white/70">Profanity filter</span>
              <button onClick={() => updateGuardrails({ profanityFilter: !config.guardrails.profanityFilter })}>
                <Badge variant={config.guardrails.profanityFilter ? "green" : "ghost"}>
                  {config.guardrails.profanityFilter ? "ON" : "OFF"}
                </Badge>
              </button>
            </div>
          </div>
        </Card>

        {/* Triggers */}
        <Card padding={16} className="mb-4">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold block mb-3">
            Replies to
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {TRIGGER_LABELS.map((t) => (
              <Chip
                key={t.key}
                selected={config.triggers[t.key as TriggerType]}
                onClick={() => toggleTrigger(t.key as TriggerType)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
          <p className="text-[9px] text-white/20 mt-2">
            {TRIGGER_LABELS.find((t) => config.triggers[t.key as TriggerType])?.hint ?? "Pick at least one trigger."}
          </p>
        </Card>

        {/* Platforms */}
        <Card padding={16} className="mb-4">
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold block mb-3">
            Platforms
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {platformOptions.map((p) => (
              <Chip key={p.key} selected={config.platforms[p.key]} onClick={() => togglePlatform(p.key)}>
                {p.icon} {p.label}
              </Chip>
            ))}
          </div>
        </Card>

        {/* Tool access */}
        <Card padding={16}>
          <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold block mb-1">
            Tool Access
          </span>
          <p className="text-[10px] text-white/25 mb-3">
            What the co-host can act on, not just talk about — nothing here actually calls anything yet.
          </p>
          <div className="flex flex-col gap-1.5">
            {TOOL_ACCESS_OPTIONS.map((t) => (
              <div key={t.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/70">{t.label}</span>
                    {t.risk === "medium" && (
                      <Badge variant="amber" className="text-[8px]">
                        changes state
                      </Badge>
                    )}
                  </div>
                  <span className="text-[9px] text-white/25">{t.hint}</span>
                </div>
                <button onClick={() => toggleTool(t.key)} className="shrink-0 ml-2">
                  <Badge variant={config.tools[t.key] ? "green" : "ghost"}>
                    {config.tools[t.key] ? "ON" : "OFF"}
                  </Badge>
                </button>
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => update({ enabled: false })} disabled={!config.enabled}>
            Disable Co-Host
          </Button>
        </div>
      </div>
    </div>
  );
}
