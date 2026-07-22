import { registerApp } from "../registry";
import OverlayLibraryApp from "./App";

registerApp({
  id: "overlay-library",
  name: "Overlay Library",
  icon: "🖼️",
  description: "Every browser-source overlay in one place — built-in widgets, live alerts, and your own custom overlays.",
  category: "media",
  component: OverlayLibraryApp,
  featured: true,
});
