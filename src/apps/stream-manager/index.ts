import { registerApp } from "../registry";
import StreamManagerApp from "./App";

registerApp({
  id: "stream-manager",
  name: "Stream Manager",
  icon: "🛠️",
  description: "Update your title, category, and tags across Twitch and Kick, and run your pre-stream checklist.",
  category: "tools",
  component: StreamManagerApp,
  featured: true,
});
