import { registerApp } from "../registry";
import SoundBoardApp from "./App";

registerApp({
  id: "sound-board",
  name: "Sound Board",
  icon: "🔊",
  description: "Trigger sound effects on stream. Airhorn, applause, vine boom, and more at your fingertips.",
  category: "media",
  component: SoundBoardApp,
});
