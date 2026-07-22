import { registerApp } from "../registry";
import SoundBoardApp from "./App";

registerApp({
  id: "sound-board",
  name: "Sound Board",
  icon: "🔊",
  description: "Play your own sound clips on stream with one click or a hotkey.",
  category: "media",
  component: SoundBoardApp,
});
