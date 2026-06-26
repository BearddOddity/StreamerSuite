import { useState } from "react";

interface SoundPad {
  id: string;
  name: string;
  icon: string;
  color: string;
  hotkey: string;
}

const defaultPads: SoundPad[] = [
  { id: "airhorn", name: "Airhorn", icon: "📯", color: "border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/20", hotkey: "1" },
  { id: "applause", name: "Applause", icon: "👏", color: "border-green-500/25 bg-green-500/10 hover:bg-green-500/20", hotkey: "2" },
  { id: "sad", name: "Sad Violin", icon: "🎻", color: "border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/20", hotkey: "3" },
  { id: "vine-boom", name: "Vine Boom", icon: "💥", color: "border-red-500/25 bg-red-500/10 hover:bg-red-500/20", hotkey: "4" },
  { id: "bruh", name: "Bruh", icon: "🤦", color: "border-purple-500/25 bg-purple-500/10 hover:bg-purple-500/20", hotkey: "5" },
  { id: "oof", name: "Oof", icon: "😬", color: "border-pink-500/25 bg-pink-500/10 hover:bg-pink-500/20", hotkey: "6" },
  { id: "wow", name: "Wow", icon: "😮", color: "border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20", hotkey: "7" },
  { id: "laugh", name: "Laugh Track", icon: "😂", color: "border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/20", hotkey: "8" },
  { id: "drumroll", name: "Drumroll", icon: "🥁", color: "border-orange-500/25 bg-orange-500/10 hover:bg-orange-500/20", hotkey: "9" },
  { id: "cricket", name: "Cricket", icon: "🦗", color: "border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20", hotkey: "0" },
  { id: "rimshot", name: "Rimshot", icon: "🎵", color: "border-indigo-500/25 bg-indigo-500/10 hover:bg-indigo-500/20", hotkey: "Q" },
  { id: "sadtrombone", name: "Sad Trombone", icon: "🎺", color: "border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20", hotkey: "W" },
];

export default function SoundBoardApp() {
  const [pads] = useState<SoundPad[]>(defaultPads);
  const [activePad, setActivePad] = useState<string | null>(null);
  const [volume, setVolume] = useState(75);

  const triggerPad = (pad: SoundPad) => {
    setActivePad(pad.id);
    setTimeout(() => setActivePad(null), 300);
    // In a real app, this would play the audio file
  };

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-white/90">Sound Board</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Trigger sound effects during your stream</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/25">🔊</span>
              <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 h-1 accent-[var(--accent-system)] bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-system)]" />
              <span className="text-[10px] text-white/30 font-mono w-7">{volume}%</span>
            </div>
          </div>
        </div>

        {/* Sound pads grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {pads.map((pad) => (
            <button key={pad.id} onClick={() => triggerPad(pad)}
              className={`relative p-5 rounded-2xl border text-center transition-all ${pad.color} ${
                activePad === pad.id ? "scale-95 brightness-125" : "hover:-translate-y-0.5 hover:shadow-lg"
              }`}>
              <span className="absolute top-1.5 right-2 text-[9px] text-white/20 font-mono">{pad.hotkey}</span>
              <span className="text-3xl block mb-2">{pad.icon}</span>
              <span className="text-[11px] font-medium text-white/60 block">{pad.name}</span>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 card-glass p-4">
          <p className="text-[11px] text-white/25 leading-relaxed">
            🎵 Add your own sound files by placing <code className="text-white/40 bg-white/[0.04] px-1 rounded">.mp3</code> or <code className="text-white/40 bg-white/[0.04] px-1 rounded">.wav</code> files in the sounds directory.
            Press the corresponding hotkey to trigger sounds instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
