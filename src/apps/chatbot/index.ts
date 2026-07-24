import { registerApp } from "../registry";
import ChatbotApp from "./App";

registerApp({
  id: "chatbot",
  name: "Chatbot",
  icon: "🤖",
  description: "Custom chat commands across Twitch, Kick, Joystick.tv, and Streamer.bot. Preview — command execution isn't wired up yet.",
  category: "chat",
  component: ChatbotApp,
});
