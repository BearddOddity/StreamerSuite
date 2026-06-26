import { useEffect, useRef, useState, useMemo } from "react";
import type { ChatMessage as ChatMessageType, Platform, ChatChannel } from "@/types";
import ChatMessage from "./ChatMessage";

interface Props {
  messages: ChatMessageType[];
  channelName: string;
  platform: Platform | null;
  channelId?: string;
  isConnected: boolean;
  onSendMessage: (platform: Platform, channelId: string, content: string) => void;
  isMultiChat?: boolean;
  connectedChannels?: ChatChannel[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const platformAccent: Record<string, string> = {
  twitch: "text-[#9146ff]",
  kick: "text-[#53fc18]",
  joystick: "text-[#ff6b35]",
};

const platformBadge: Record<string, string> = {
  twitch: "badge-purple",
  kick: "badge-green",
  joystick: "badge-amber",
};

export default function ChatPanel({
  messages,
  channelName,
  platform,
  channelId,
  isConnected,
  onSendMessage,
  isMultiChat = false,
  connectedChannels = [],
  sidebarOpen,
  onToggleSidebar,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (isMultiChat && connectedChannels.length > 0 && !selectedPlatform) {
      const first = connectedChannels[0];
      if (first) setSelectedPlatform(first.platform);
    }
  }, [isMultiChat, connectedChannels, selectedPlatform]);

  const platformColor = platform ? (platformAccent[platform] ?? "text-white/80") : "text-[var(--accent-system)]";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !isConnected) return;
    if (isMultiChat && selectedPlatform) {
      const target = connectedChannels.find((c) => c.platform === selectedPlatform);
      if (target) onSendMessage(selectedPlatform, target.channelId, inputValue.trim());
    } else if (platform && channelId) {
      onSendMessage(platform, channelId, inputValue.trim());
    }
    setInputValue("");
    inputRef.current?.focus();
  };

  const platformSummary = useMemo(() => {
    if (!isMultiChat) return null;
    const counts: Record<string, number> = {};
    for (const ch of connectedChannels) {
      counts[ch.platform] = (counts[ch.platform] ?? 0) + 1;
    }
    return counts;
  }, [isMultiChat, connectedChannels]);

  return (
    <div className="flex flex-col h-full bg-bg-chat">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 shrink-0 surface-1">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-all shrink-0"
            title="Open sidebar"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}
        {isMultiChat ? (
          <>
            <span className="text-base">🔀</span>
            <span className={`text-sm font-bold ${platformColor}`}>{channelName}</span>
            {platformSummary && (
              <div className="flex items-center gap-1.5 ml-1">
                {Object.entries(platformSummary).map(([plat, count]) => (
                  <span key={plat} className={`badge ${platformBadge[plat] ?? "badge-ghost"}`}>
                    {plat} ×{count}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <span className={`text-sm font-bold ${platformColor}`}>{channelName}</span>
            <span className="badge badge-ghost">{platform}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`status-dot ${isConnected ? "on" : "off"}`} />
          <span className={`text-[10px] font-medium ${isConnected ? "text-green-400/60" : "text-white/25"}`}>
            {isConnected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/25 text-sm">
            {isConnected ? "No messages yet. Waiting for chat..." : "Waiting for connection..."}
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} isMultiChat={isMultiChat} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/[0.06] shrink-0 surface-0">
        <div className="flex gap-2">
          {isMultiChat && connectedChannels.length > 1 && (
            <select
              value={selectedPlatform ?? ""}
              onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
              className="select-glass"
            >
              {connectedChannels.map((ch) => (
                <option key={`${ch.platform}:${ch.channelId}`} value={ch.platform}>
                  {ch.platform}: {ch.channelName}
                </option>
              ))}
            </select>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isConnected
                ? isMultiChat ? `Send to ${selectedPlatform ?? "..."}...` : "Send a message..."
                : "Connect to send messages"
            }
            disabled={!isConnected}
            className="input-glass flex-1"
          />
          <button
            type="submit"
            disabled={!isConnected || !inputValue.trim()}
            className="btn-cta disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
