import { registerApp } from "../registry";
import ChatConfluenceApp from "./App";

registerApp({
  id: "chat-confluence",
  name: "Multi-Chat",
  icon: "💬",
  description: "Unified multi-platform chat for Twitch, Kick, and JoystickTV. Merge all your chat feeds into one view.",
  category: "chat",
  component: ChatConfluenceApp,
  featured: true,
});
