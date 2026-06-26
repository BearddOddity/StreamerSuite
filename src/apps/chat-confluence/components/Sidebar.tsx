import type { ChatChannel, Platform } from "../types";

interface Props {
  channels: ChatChannel[];
  activeChannel: string | null;
  isMultiChat: boolean;
  onSelectChannel: (key: string) => void;
  onAddChannel: () => void;
  onDisconnect: (platform: Platform, channelId: string) => void;
  onToggleMultiChat: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

const platformMeta: Record<string, { label: string; dot: string; tag: string }> = {
  twitch: { label: "Twitch", dot: "bg-[#9146ff]", tag: "bg-[#9146ff]/15 text-[#9146ff] border-[#9146ff]/20" },
  kick: { label: "Kick", dot: "bg-[#53fc18]", tag: "bg-[#53fc18]/15 text-[#53fc18] border-[#53fc18]/20" },
  joystick: { label: "JoystickTV", dot: "bg-[#ff6b35]", tag: "bg-[#ff6b35]/15 text-[#ff6b35] border-[#ff6b35]/20" },
};

export default function Sidebar({
  channels, activeChannel, isMultiChat, onSelectChannel, onAddChannel,
  onDisconnect, onToggleMultiChat, onOpenSettings, onToggleSidebar,
}: Props) {
  const connectedCount = channels.filter((c) => c.isConnected).length;

  return (
    <div className="w-64 shrink-0 bg-bg-secondary/60 border-r border-white/[0.06] flex flex-col h-full">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <span className="text-accent-system text-sm">⚡</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-white/90 tracking-tight">ChatConfluence</h1>
            <p className="text-[10px] text-white/30 leading-none mt-0.5">Multi-platform chat</p>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button onClick={onToggleMultiChat}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all border ${
            isMultiChat
              ? "bg-[#9146ff]/10 border-[#9146ff]/25 text-[#9146ff] shadow-md shadow-[#9146ff]/5"
              : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.1]"
          }`}>
          <span className="text-base">🔀</span>
          <span>Multi-Chat</span>
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${isMultiChat ? "bg-[#9146ff]/15 text-[#9146ff]" : "bg-white/[0.04] text-white/30"}`}>
            {isMultiChat ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-1">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Channels</span>
          <button onClick={onAddChannel} className="flex items-center gap-1 text-[11px] text-[#9146ff]/70 hover:text-[#9146ff] transition-colors font-medium">
            <span className="text-[10px]">+</span> Add
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <div className="text-2xl mb-2 opacity-15">📡</div>
            <p className="text-[11px] text-white/25 leading-relaxed">
              No channels yet.<br />Click <span className="text-[#9146ff]/70 font-medium">+ Add</span> to connect.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {channels.map((ch) => {
              const key = `${ch.platform}:${ch.channelId}`;
              const isActive = isMultiChat || activeChannel === key;
              const meta = platformMeta[ch.platform] ?? { label: ch.platform, dot: "bg-white/30", tag: "bg-white/5 text-white/30 border-white/10" };
              return (
                <div key={key} onClick={() => onSelectChannel(key)}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
                    isActive ? "bg-white/[0.06] border border-white/[0.08]" : "hover:bg-white/[0.03] border border-transparent"
                  }`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ch.isConnected ? meta.dot : "bg-white/15"} ${ch.isConnected ? "status-dot-pulse" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-white/80 truncate leading-tight">{ch.channelName}</span>
                      <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${ch.connectionMode === "api" ? "bg-white/[0.04] text-white/25" : "bg-white/[0.03] text-white/15"}`}>
                        {ch.connectionMode === "api" ? "API" : "WS"}
                      </span>
                    </div>
                    <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-md border mt-1 font-semibold uppercase tracking-wider ${meta.tag}`}>
                      {meta.label}
                    </span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onDisconnect(ch.platform, ch.channelId); }}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-red-400/40 hover:text-red-400/80 hover:bg-red-500/10 text-xs transition-all" title="Disconnect">
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/[0.04]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] text-white/25">{channels.length} channel{channels.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connectedCount > 0 ? "bg-green-400 status-dot-pulse" : "bg-white/15"}`} />
            <span className="text-[10px] text-white/25">{connectedCount} connected</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenSettings}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] text-white/30 bg-white/[0.03] border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all" title="Settings">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Settings
          </button>
          <button onClick={onToggleSidebar}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] text-white/30 bg-white/[0.03] border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all" title="Collapse sidebar">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}
