import { useRef } from "react";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import type { AlertKind, AlertsSettings, TwitchAccount } from "./types";
import { Button, Card, Chip, StatusDot } from "../../design-system/components/core";

type ConnStatus = "disconnected" | "connecting" | "live" | "error";

const EVENT_ICON_KINDS: { kind: AlertKind; label: string; defaultEmoji: string }[] = [
  { kind: "follow", label: "Follow", defaultEmoji: "💜" },
  { kind: "sub", label: "Sub / Resub / Gift Sub", defaultEmoji: "⭐" },
  { kind: "raid", label: "Raid", defaultEmoji: "🚀" },
  { kind: "cheer", label: "Cheer", defaultEmoji: "💎" },
  { kind: "tip", label: "Tip", defaultEmoji: "💰" },
];

function EventIconRow({
  kind,
  label,
  defaultEmoji,
  current,
  onSet,
}: {
  kind: AlertKind;
  label: string;
  defaultEmoji: string;
  current: string | undefined;
  onSet: (kind: AlertKind, dataUri: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
      <div className="w-7 h-7 flex items-center justify-center shrink-0">
        {current ? <img src={current} alt="" className="w-6 h-6 object-contain" /> : <span className="text-lg">{defaultEmoji}</span>}
      </div>
      <span className="text-[12px] text-white/70 flex-1">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onSet(kind, String(reader.result));
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
      <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
        Upload
      </Button>
      {current && (
        <Button variant="ghost" size="sm" onClick={() => onSet(kind, null)}>
          Reset
        </Button>
      )}
    </div>
  );
}

/** Maps the feed's 4-state connection status onto StatusDot's 3 visual states —
 *  "error" reads as "warn" since the shared dot has no red variant. */
function toDotStatus(status: ConnStatus): "on" | "off" | "warn" {
  if (status === "live") return "on";
  if (status === "connecting" || status === "error") return "warn";
  return "off";
}

export function SettingsPanel({
  settings,
  onUpdate,
  onToggle,
  twitchAccount,
  twitchStatus,
  kickStatus,
  joystickStatus,
  chaturbateStatus,
  adultContentEnabled,
  eventIcons,
  onSetEventIcon,
  onClose,
}: {
  settings: AlertsSettings;
  onUpdate: (patch: Partial<AlertsSettings>) => void;
  onToggle: (key: keyof AlertsSettings["enabled"]) => void;
  twitchAccount: TwitchAccount | null;
  onTwitchAccountChange: () => void;
  twitchStatus: ConnStatus;
  kickStatus: ConnStatus;
  joystickStatus: ConnStatus;
  chaturbateStatus: ConnStatus;
  adultContentEnabled: boolean;
  eventIcons: Partial<Record<AlertKind, string>>;
  onSetEventIcon: (kind: AlertKind, dataUri: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <Card padding={24} className="w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-white/90">Alert Settings</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        {/* Twitch */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="twitch" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Twitch</span>
            <StatusDot status={toDotStatus(twitchStatus)} />
          </div>
          {twitchAccount ? (
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-[12px] text-white/70">Connected via StreamerSuite Settings</span>
            </div>
          ) : (
            <p className="text-[10px] text-white/30">
              Twitch is connected in one place now — open StreamerSuite Settings → Connections &amp; Keys
              to connect your Twitch account. Alerts will start flowing here automatically once it's connected.
            </p>
          )}
          {twitchAccount && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(["twitchFollow", "twitchSub", "twitchRaid", "twitchCheer"] as const).map((k) => (
                <Chip key={k} selected={settings.enabled[k]} onClick={() => onToggle(k)}>
                  {k.replace("twitch", "")}
                </Chip>
              ))}
            </div>
          )}
        </section>

        {/* Kick */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PlatformIcon platform="kick" size="sm" />
            <span className="text-[12px] font-semibold text-white/70">Kick</span>
            <StatusDot status={toDotStatus(kickStatus)} />
          </div>
          <input
            value={settings.kickSlug}
            onChange={(e) => onUpdate({ kickSlug: e.target.value })}
            placeholder="channel slug (e.g. beardds)"
            className="w-full input-glass text-[12px]"
          />
          <p className="text-[10px] text-white/30 mt-1">
            No login needed — subs, gifted subs, and hosts are public on Kick's channel feed.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["kickSub", "kickHost"] as const).map((k) => (
              <Chip key={k} selected={settings.enabled[k]} onClick={() => onToggle(k)}>
                {k.replace("kick", "")}
              </Chip>
            ))}
          </div>
        </section>

        {/* Joystick — off by default (General -> Adult Content & Platforms),
            zero mention anywhere in this tool until turned on there. */}
        {adultContentEnabled && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <PlatformIcon platform="joystick" size="sm" />
              <span className="text-[12px] font-semibold text-white/70">Joystick.tv</span>
              <StatusDot status={toDotStatus(joystickStatus)} />
            </div>
            <p className="text-[10px] text-white/30">
              Uses the same Joystick.tv bot connection as Multi-Chat — connect it there first. Tips show up here as alerts.
            </p>
            <div className="mt-2">
              <Chip selected={settings.enabled.joystickTip} onClick={() => onToggle("joystickTip")}>
                Tips
              </Chip>
            </div>
          </section>
        )}

        {/* Chaturbate — off by default (General -> Adult Content &
            Platforms), zero mention anywhere in this tool until turned on
            there. Read-only Events API: tips and follows only, no chat
            (that's Multi-Chat's job) and no sending/moderation exists. */}
        {adultContentEnabled && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <PlatformIcon platform="chaturbate" size="sm" />
              <span className="text-[12px] font-semibold text-white/70">Chaturbate</span>
              <StatusDot status={toDotStatus(chaturbateStatus)} />
            </div>
            <p className="text-[10px] text-white/30">
              Connect your username/API token in StreamerSuite Settings → Connections & Keys first.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip selected={settings.enabled.chaturbateTip} onClick={() => onToggle("chaturbateTip")}>
                Tips
              </Chip>
              <Chip selected={settings.enabled.chaturbateFollow} onClick={() => onToggle("chaturbateFollow")}>
                Follows
              </Chip>
            </div>
          </section>
        )}

        <section className="mb-6">
          <span className="text-[12px] font-semibold text-white/70 block mb-2">Event Icons</span>
          <p className="text-[10px] text-white/30 mb-2">
            Custom icons for each alert kind — used here and in Multi-Chat's chat-feed chips (its
            Sub/Resub and Gift Sub chips both use the Sub icon below).
          </p>
          <div className="space-y-1.5">
            {EVENT_ICON_KINDS.map(({ kind, label, defaultEmoji }) => (
              <EventIconRow key={kind} kind={kind} label={label} defaultEmoji={defaultEmoji} current={eventIcons[kind]} onSet={onSetEventIcon} />
            ))}
          </div>
        </section>

        <section>
          <button
            onClick={() => onUpdate({ soundEnabled: !settings.soundEnabled })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08]"
          >
            <span className="text-[12px] text-white/70">Alert sound</span>
            <span className="text-[12px]">{settings.soundEnabled ? "🔊 On" : "🔇 Off"}</span>
          </button>
        </section>
      </Card>
    </div>
  );
}
