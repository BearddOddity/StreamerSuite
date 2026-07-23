import { SharedSettingsProvider } from "@/settings";
import AppShell from "@/shell/AppShell";

export default function App() {
  return (
    <SharedSettingsProvider>
      <AppShell />
    </SharedSettingsProvider>
  );
}
