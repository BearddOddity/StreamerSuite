import { registerApp } from "../registry";
import EmbeddedMultiChat from "./EmbeddedMultiChat";

// AppShell special-cases "multi-chat" to keep EmbeddedMultiChat mounted
// persistently (hidden, not unmounted, when another app is active) instead
// of rendering `component` through the normal per-app conditional — see
// AppShell.tsx. This is still wired up for metadata/type consistency and
// as the source of truth for what actually renders.
registerApp({
  id: "multi-chat",
  name: "Multi-Chat",
  icon: "💬",
  description: "Unified multi-platform chat for Twitch, Kick, and JoystickTV. Merge all your chat feeds into one view.",
  category: "chat",
  component: EmbeddedMultiChat,
  featured: true,
});
