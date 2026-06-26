import { useEffect, useRef, useState, useMemo } from "react";
import type { ChatMessage as ChatMessageType, Platform, ChatChannel } from "@/types";
import ChatMessage from "./ChatMessage";
import { GlassSelect } from "../settings/SettingsComponents";

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

  const platformOptions = useMemo(
    () =>
      connectedChannels.map((ch) => ({
        value: ch.platform,
        label: `${ch.platform}: ${ch.channelName}`,
      })),
    [connectedChannels]
  );

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
  };

  return (
    <div className="flex flex-col h-full bg-black/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isMultiChat ? (
            <span className="text-white font-medium truncate">{channelName}</span>
          ) : (
            <>
              <span className={`text-xs font-semibold ${platformBadge[platform ?? ""] ?? "badge-gray"}`}>
                {platform?.toUpperCase() ?? "CHAT"}
              </span>
              <span className="text-white font-medium truncate">{channelName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
          <button onClick={onToggleSidebar} className="btn-icon" title="Toggle user list">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
        <div ref={bottomRef} className="flex flex-col gap-3 min-h-full">
          {messages.map((msg, idx) => (
            <ChatMessage key={`${msg.id}-${idx}`} message={msg} />
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/[0.06] shrink-0 surface-0">
        <div className="flex gap-2">
          {isMultiChat && connectedChannels.length > 1 && (
            <GlassSelect
              value={selectedPlatform ?? ""}
              options={platformOptions}
              onChange={setSelectedPlatform}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isConnected
                ? isMultiChat
                  ? `Send to ${selectedPlatform ?? "..."}...`
                  : "Send a message..."
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