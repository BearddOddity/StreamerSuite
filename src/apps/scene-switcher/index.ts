import { registerApp } from "../registry";
import SceneSwitcherApp from "./App";

registerApp({
  id: "scene-switcher",
  name: "Scene Switcher",
  icon: "🎬",
  description: "Control OBS Studio or Meld Studio scenes, audio, and streaming remotely.",
  category: "tools",
  component: SceneSwitcherApp,
});
