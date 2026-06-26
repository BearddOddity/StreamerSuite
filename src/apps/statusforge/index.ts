import { registerApp } from "../registry";
import StatusForgeApp from "./App";

registerApp({
  id: "statusforge",
  name: "StatusForge",
  icon: "⏳",
  description: "Game detection engine with automatic category switching, library management, and overlay widgets for Twitch and Kick.",
  category: "tools",
  component: StatusForgeApp,
  featured: true,
});
