import { registerApp } from "../registry";
import AlertsHubApp from "./App";

registerApp({
  id: "alerts-hub",
  name: "Alerts & Events",
  icon: "🔔",
  description: "Live follow, sub, raid, cheer, and tip alerts across Twitch, Kick, and Joystick.tv.",
  category: "alerts",
  component: AlertsHubApp,
});
