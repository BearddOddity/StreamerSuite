import { registerApp } from "../registry";
import MultiChatApp from "./App";

registerApp({
  id: "multi-chat",
  name: "Multi-Chat",
  icon: "💬",
  description: "Unified multi-platform chat for Twitch, Kick, and JoystickTV. Merge all your chat feeds into one view.",
  category: "chat",
  component: MultiChatApp,
  featured: true,
});
