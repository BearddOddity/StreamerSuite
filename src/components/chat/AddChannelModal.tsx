import { useState } from "react";
import type { Platform } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (platform: Platform, channelId: string, channelName: string) => void;
}

const platforms: { id: Platform; label: string; icon: string; activeColor: string }[] = [
  { id: "twitch", label: "Twitch", icon: "🟣", activeColor: "border-[#9146ff]/30 bg-[#9146ff]/10 text-[#9146ff]" },
  { id: "kick", label: "Kick", icon: "🟢", activeColor: "border-[#53fc18]/30 bg-[#53fc18]/10 text-[#53fc18]" },
  { id: "joystick", label: "JoystickTV", icon: "🟠", activeColor: "border-[#ff6b35]/30 bg-[#ff6b35]/10 text-[#ff6b35]" },
];

export default function AddChannelModal({ isOpen, onClose, onAdd }: Props) {
  const [platform, setPlatform] = useState<Platform>("twitch");
  const [channelId, setChannelId] = useState("");
  const [channelName, setChannelName] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId.trim() || !channelName.trim()) return;
    onAdd(platform, channelId.trim(), channelName.trim());
    setChannelId("");
    setChannelName("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-float-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-[420px] bg-[#0a0a0f]/95 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-xl animate-float-card-in overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <span className="text-[#9146ff] text-base">+</span>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white/90">Add Channel</h2>
            <p className="text-[11px] text-white/30">Connect a new chat channel</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wider">Platform</label>
            <div className="flex gap-2">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                    platform === p.id
                      ? p.activeColor
                      : "border-white/[0.06] text-white/35 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
                  }`}
                >
                  <span className="text-sm">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wider">Channel ID</label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="e.g. xqc or channel name"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[#9146ff]/40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wider">Display Name</label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g. xQc"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[#9146ff]/40"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-white/40 border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!channelId.trim() || !channelName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#9146ff] to-[#6b2cff] text-white shadow-lg shadow-[#9146ff]/15 hover:shadow-[#9146ff]/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
