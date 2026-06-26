import { SharedSettingsProvider } from "@/settings";
import AppShell from "@/shell/AppShell";
import "@/index.css";

export default function App() {
  return (
    <SharedSettingsProvider>
      <AppShell />
    </SharedSettingsProvider>
  );
}
