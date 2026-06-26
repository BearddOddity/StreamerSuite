import { registerApp } from "../registry";
import AlertsHubApp from "./App";

registerApp({
  id: "alerts-hub",
  name: "Alerts & Events",
  icon: "🔔",
  description: "Follow, sub, donation, raid, and host alerts. Test alerts and manage event sounds.",
  category: "alerts",
  component: AlertsHubApp,
});
