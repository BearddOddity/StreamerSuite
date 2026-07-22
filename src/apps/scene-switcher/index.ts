import { registerApp } from "../registry";
import SceneSwitcherApp from "./App";

registerApp({
  id: "scene-switcher",
  name: "Scene Switcher",
  icon: "🎬",
  description: "Control Meld Studio scenes, audio, and streaming remotely over its WebSocket API.",
  category: "tools",
  component: SceneSwitcherApp,
});
