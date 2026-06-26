import type { ChatChannel, Platform, ConnectionMode } from "../types";

interface Props {
  channels: ChatChannel[];
  onSetConnectionMode: (platform: Platform, channelId: string, mode: ConnectionMode) => void;
}

const platformMeta: Record<string, { label: string; icon: string; color: string }> = {
  twitch: { label: "Twitch", icon: "🟣", color: "text-[#9146ff]" },
  kick: { label: "Kick", icon: "🟢", color: "text-[#53fc18]" },
  joystick: { label: "JoystickTV", icon: "🟠", color: "text-[#ff6b35]" },
};

const modeInfo: Record<ConnectionMode, { label: string; desc: string }> = {
  api: { label: "API Mode", desc: "Uses platform REST APIs. More reliable, no raw WebSocket connections." },
  ws: { label: "WebSocket Mode", desc: "Direct WebSocket/Pusher connection. May be needed for real-time chat on some platforms." },
};

export default function ConnectionsTab({ channels, onSetConnectionMode }: Props) {
  if (channels.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2 opacity-15">⚙️</div>
        <p className="text-[11px] text-white/25 leading-relaxed">No channels configured yet.<br />Add channels to configure connection modes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {channels.map((ch) => {
        const meta = platformMeta[ch.platform] ?? { label: ch.platform, icon: "⚪", color: "text-white/30" };
        return (
          <div key={`${ch.platform}:${ch.channelId}`} className="bg-black/30 border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white/80">{ch.channelName}</div>
                <div className="text-[10px] text-white/25">{meta.label}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${ch.connectionMode === "api" ? "bg-[var(--accent-system)]/10 text-[var(--accent-system)]/70" : "bg-white/[0.04] text-white/25"}`}>
                {ch.connectionMode === "api" ? "API" : "WS"}
              </span>
            </div>
            <p className="text-[10px] text-white/25 mb-2">{modeInfo[ch.connectionMode].desc}</p>
            <div className="flex gap-2">
              <button onClick={() => onSetConnectionMode(ch.platform, ch.channelId, "api")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  ch.connectionMode === "api"
                    ? "bg-[var(--accent-system)]/10 border-[var(--accent-system)]/25 text-[var(--accent-system)] shadow-md shadow-[var(--accent-system)]/5"
                    : "border-white/[0.06] text-white/30 hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}>
                {modeInfo.api.label}
              </button>
              <button onClick={() => onSetConnectionMode(ch.platform, ch.channelId, "ws")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  ch.connectionMode === "ws"
                    ? "bg-white/[0.06] border-white/[0.12] text-white/70"
                    : "border-white/[0.06] text-white/30 hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}>
                {modeInfo.ws.label}
              </button>
            </div>
            {ch.platform === "twitch" && <p className="text-[10px] text-[#9146ff]/40 italic mt-2">ℹ️ Twitch uses IRC WebSocket for real-time chat (no public read API).</p>}
            {ch.platform === "joystick" && <p className="text-[10px] text-[#ff6b35]/40 italic mt-2">ℹ️ JoystickTV has no public API — falls back to WebSocket automatically.</p>}
            <p className="text-[10px] text-white/15 mt-1">⚠️ Changes apply when you reconnect.</p>
          </div>
        );
      })}
    </div>
  );
}
