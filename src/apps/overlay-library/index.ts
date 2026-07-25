import { registerApp } from "../registry";
import OverlayLibraryApp from "./App";

registerApp({
  id: "overlay-library",
  name: "Overlay Library",
  icon: "🖼️",
  description: "Browse and copy the URL for every browser-source overlay — built-in widgets and your own custom overlays. Build new ones with the editor app (🧩).",
  category: "media",
  component: OverlayLibraryApp,
  featured: true,
});
