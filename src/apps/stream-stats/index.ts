import { registerApp } from "../registry";
import StreamStatsApp from "./App";

registerApp({
  id: "stream-stats",
  name: "Stream Stats",
  icon: "📊",
  description: "Real-time viewer counts, uptime, follower tracking, and platform breakdowns.",
  category: "utilities",
  component: StreamStatsApp,
});
