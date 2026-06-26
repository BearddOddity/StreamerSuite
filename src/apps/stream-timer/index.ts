import { registerApp } from "../registry";
import StreamTimerApp from "./App";

registerApp({
  id: "stream-timer",
  name: "Stream Timer",
  icon: "⏱️",
  description: "Stopwatch and countdown timer for stream sessions. Track your stream duration or set break timers.",
  category: "tools",
  component: StreamTimerApp,
  featured: true,
});
