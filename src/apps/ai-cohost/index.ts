import { registerApp } from "../registry";
import CoHostApp from "./App";

registerApp({
  id: "ai-cohost",
  name: "AI Co-Host",
  icon: "🤖",
  description: "A persona-driven AI co-host for chat, powered by a free open model from Hugging Face. Preview — not wired up to actually respond yet.",
  category: "chat",
  component: CoHostApp,
});
