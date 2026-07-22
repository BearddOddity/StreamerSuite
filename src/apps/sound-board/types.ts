export interface SoundPad {
  id: string;
  name: string;
  filePath: string;
  hotkey: string;
  color: string;
  volume: number; // 0-100, per-pad multiplier on top of master volume
}

export const PAD_COLORS = [
  "border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/20",
  "border-green-500/25 bg-green-500/10 hover:bg-green-500/20",
  "border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/20",
  "border-red-500/25 bg-red-500/10 hover:bg-red-500/20",
  "border-purple-500/25 bg-purple-500/10 hover:bg-purple-500/20",
  "border-pink-500/25 bg-pink-500/10 hover:bg-pink-500/20",
  "border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20",
  "border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/20",
  "border-orange-500/25 bg-orange-500/10 hover:bg-orange-500/20",
  "border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20",
  "border-indigo-500/25 bg-indigo-500/10 hover:bg-indigo-500/20",
  "border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20",
];

export const HOTKEY_POOL = "1234567890QWERTYUIOPASDFGHJKLZXCVBNM".split("");
