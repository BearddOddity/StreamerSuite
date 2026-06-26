import type { ChatMessage as ChatMessageType } from "@/types";

interface Props {
  message: ChatMessageType;
  isMultiChat?: boolean;
}

const platformConfig: Record<string, { icon: string; badge: string }> = {
  twitch: {
    icon: "🟣",
    badge: "badge-purple",
  },
  kick: {
    icon: "🟢",
    badge: "badge-green",
  },
  joystick: {
    icon: "🟠",
    badge: "badge-amber",
  },
};

export default function ChatMessage({ message, isMultiChat }: Props) {
  const cfg = platformConfig[message.platform];

  if (message.user.id === "system") {
    return (
      <div className="px-4 py-1.5 text-[11px] text-white/25 italic flex items-center gap-2">
        {cfg && <span className="text-[10px] opacity-40">{cfg.icon}</span>}
        <span>— {message.content}</span>
      </div>
    );
  }

  return (
    <div
      className={`group px-4 py-1 hover:bg-white/[0.02] text-sm leading-relaxed transition-colors ${
        isMultiChat ? "flex items-start gap-2" : ""
      }`}
    >
      {isMultiChat && cfg && (
        <span className={`badge ${cfg.badge} shrink-0 mt-0.5`}>
          {message.platform}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {!isMultiChat && (
          <span className="mr-1.5 text-[10px] opacity-30">{cfg?.icon ?? "⚪"}</span>
        )}

        {message.user.badges.length > 0 && (
          <span className="mr-1">
            {message.user.badges.map((badge, i) => (
              <span
                key={i}
                className="inline-block px-1 py-0.5 mr-0.5 text-[9px] rounded bg-white/[0.04] text-white/30 border border-white/[0.06]"
              >
                {badge.text}
                {badge.count ? `×${badge.count}` : ""}
              </span>
            ))}
          </span>
        )}

        <span
          className="font-semibold cursor-pointer hover:underline"
          style={{ color: message.user.color }}
        >
          {message.user.displayName}
        </span>

        <span className="text-white/20">: </span>
        <span className="text-white/70 break-words">{message.content}</span>
      </div>
    </div>
  );
}
