import { registerApp } from "../registry";
import SceneSwitcherApp from "./App";

registerApp({
  id: "scene-switcher",
  name: "Scene Switcher",
  icon: "🎬",
  description: "Control OBS scenes remotely. Switch between Starting Soon, Gameplay, BRB, and more.",
  category: "tools",
  component: SceneSwitcherApp,
});
