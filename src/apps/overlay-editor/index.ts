import { registerApp } from "../registry";
import OverlayEditorApp from "./App";

registerApp({
  id: "overlay-editor",
  name: "Overlay Editor",
  icon: "🧩",
  description: "Build browser-source overlays with a drag-and-drop canvas — single widgets or multi-widget layouts, live-bound to your stream data.",
  category: "media",
  component: OverlayEditorApp,
  featured: true,
});
