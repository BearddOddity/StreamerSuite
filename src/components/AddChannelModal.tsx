import { useState } from "react";
import type { Platform } from "@/types";
import { PlatformIcon } from "./common/PlatformIcon";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (platform: Platform, channelId: string, channelName: string) => void;
}

const platforms: { id: Platform; label: string; iconVariant: "color" | "light" | "dark"; activeColor: string }[] = [
  { id: "twitch", label: "Twitch", iconVariant: "color", activeColor: "border-[#9146ff]/30 bg-[#9146ff]/10 text-[#9146ff]" },
  { id: "kick", label: "Kick", iconVariant: "color", activeColor: "border-[#53fc18]/30 bg-[#53fc18]/10 text-[#53fc18]" },
  { id: "joystick", label: "JoystickTV", iconVariant: "dark", activeColor: "border-[#76e1f0]/30 bg-[#76e1f0]/10 text-[#76e1f0]" },
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
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel w-[420px] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="section-head">
            <span className="section-head-icon">+</span>
            <div className="section-head-text">
              <h2 className="section-head-title">Add Channel</h2>
              <p className="section-head-desc">Connect a new chat channel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all cursor-pointer text-xs"
          >�</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Platform selector */}
          <div>
            <label className="block text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wider">
              Platform
            </label>
            <div className="flex gap-2">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                    platform === p.id
                      ? p.activeColor
                      : "border-white/[0.06] text-white/35 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
                  }`}
                >
                  <PlatformIcon platform={p.id} size="sm" variant={p.iconVariant} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Channel ID */}
          <div>
            <label className="block text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wider">
              Channel ID
            </label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="e.g. xqc or channel name"
              className="input-glass"
              autoFocus
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g. xQc"
              className="input-glass"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!channelId.trim() || !channelName.trim()}
              className="btn-cta flex-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
