import { useEffect, useState } from "react";
import type { SystemConfig } from "@/settings";
import {
  Toggle,
  SettingsRow,
  CollapsibleSection,
  GlassSelect,
} from "./SettingsComponents";
import { fetchConfig, saveConfig } from "@statusforge/hooks/useTauriApi";
import type { AppConfig } from "@statusforge/types";

interface Props extends SystemConfig {
  onFieldChange: <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => void;
}

const languages = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
];

const languageOptions = languages.map((l) => ({ value: l.code, label: l.label }));
const updateChannelOptions = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta (Nightly)" },
  { value: "closed-beta", label: "Closed Beta (Dev)" },
];
const logLevelOptions = [
  { value: "error", label: "Error" },
  { value: "warn", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

/// Self-contained (own fetch/save) rather than threaded through SystemConfig
/// like the rest of this tab — the flag lives in the shared AppConfig
/// (engine_settings.adult_content_enabled) since every tool that hides
/// Joystick.tv on it (Connections & Keys, Multi-Chat, Chatbot, AI Co-Host,
/// Alerts Hub) reads that same config, not the browser-local SystemConfig.
function AdultContentSection() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClosing, setConfirmClosing] = useState(false);

  useEffect(() => {
    fetchConfig().then(setConfig);
  }, []);

  const enabled = config?.engine_settings.adult_content_enabled ?? false;

  const closeConfirm = () => {
    setConfirmClosing(true);
    setTimeout(() => {
      setConfirmOpen(false);
      setConfirmClosing(false);
    }, 200);
  };

  const setEnabled = async (next: boolean) => {
    if (!config) return;
    const updated: AppConfig = {
      ...config,
      engine_settings: { ...config.engine_settings, adult_content_enabled: next },
    };
    setConfig(updated);
    await saveConfig(updated);
  };

  const confirmEnable = async () => {
    await setEnabled(true);
    closeConfirm();
  };

  return (
    <CollapsibleSection title="Adult Content & Platforms" icon="🔞">
      <SettingsRow
        label="Show 18+ Platforms"
        description="Joystick.tv and Chaturbate (and any future 18+ platform) are completely hidden — Connections & Keys, Multi-Chat, Chatbot, AI Co-Host, Alerts Hub — until this is on. Off by default."
      >
        {enabled ? (
          <Toggle on={true} onToggle={() => setEnabled(false)} />
        ) : (
          <button onClick={() => setConfirmOpen(true)} className="btn-cta text-[11px] px-3 py-1.5">
            Show 18+ Platforms
          </button>
        )}
      </SettingsRow>

      {confirmOpen && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 ${
            confirmClosing ? "" : "animate-float-backdrop"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            className={`relative w-[420px] bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 ${
              confirmClosing ? "animate-float-card-out" : "animate-float-card-in"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔞</span>
              <h3 className="text-white font-semibold text-sm">Show 18+ platforms?</h3>
            </div>
            <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
              Joystick.tv and Chaturbate are adult-oriented platforms. Turning this on makes them visible
              across every tool in StreamerSuite — Connections & Keys, Multi-Chat, Chatbot, AI Co-Host, and
              Alerts Hub — including their chat, moderation, and tip-alert surfaces. You can hide them again
              anytime from this same setting.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={closeConfirm} className="btn-ghost text-[11px] px-3 py-1.5">
                Cancel
              </button>
              <button onClick={confirmEnable} className="btn-cta text-[11px] px-3 py-1.5">
                Yes, show them
              </button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

export default function GeneralTab(props: Props) {
  const { onFieldChange: u } = props;
  const toggle = (key: keyof SystemConfig) => u(key, !props[key] as any);

  return (
    <div className="space-y-4">
      {/* Startup & OS */}
      <CollapsibleSection title="Startup & OS" icon="🚀" defaultOpen>
        <SettingsRow label="Launch on Startup" description="Start StreamerSuite when your system boots">
          <Toggle on={props.launchOnStartup} onToggle={() => toggle("launchOnStartup")} />
        </SettingsRow>
        <SettingsRow label="Auto-start Engine" description="Immediately trigger the detection engine when the app starts">
          <Toggle on={props.autoStartEngine} onToggle={() => toggle("autoStartEngine")} />
        </SettingsRow>
        <SettingsRow label="Auto-Connect Channels" description="Automatically connect to configured channels on startup">
          <Toggle on={props.autoConnectChannels} onToggle={() => toggle("autoConnectChannels")} />
        </SettingsRow>
        <SettingsRow label="Minimize to Tray" description="Closing the window hides StreamerSuite in the OS system tray">
          <Toggle on={props.minimizeToTray} onToggle={() => toggle("minimizeToTray")} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Notifications */}
      <CollapsibleSection title="Notifications" icon="🔔">
        <SettingsRow label="Master Notifications" description="Enable global desktop notifications for StreamerSuite events">
          <Toggle on={props.showNotifications} onToggle={() => toggle("showNotifications")} />
        </SettingsRow>
        <SettingsRow label="Game Detection Alerts" description="Notify when a new game is detected">
          <Toggle on={props.notifyOnGameDetect} onToggle={() => toggle("notifyOnGameDetect")} />
        </SettingsRow>
        <SettingsRow label="Stream Event Alerts" description="Notify on stream start/stop and other broadcast events">
          <Toggle on={props.notifyOnStreamEvents} onToggle={() => toggle("notifyOnStreamEvents")} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Display & Hardware */}
      <CollapsibleSection title="Display & Hardware" icon="📺">
        <SettingsRow label="Hardware Acceleration" description="Use GPU for composited window rendering (reduces lag)">
          <Toggle on={props.hardwareAccel} onToggle={() => toggle("hardwareAccel")} />
        </SettingsRow>
        <SettingsRow label="Language" description="Display language for the interface">
          <GlassSelect value={props.language} options={languageOptions} onChange={(v) => u("language", v)} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Integrations & Rich Presence */}
      <CollapsibleSection title="Integrations & Rich Presence" icon="🎮">
        <SettingsRow label="Steam Rich Presence" description="Show current game in your Steam friends list">
          <Toggle on={props.steamRichPresence} onToggle={() => toggle("steamRichPresence")} />
        </SettingsRow>
        <SettingsRow label="Discord Rich Presence" description="Display current game in your Discord status">
          <Toggle on={props.discordRichPresence} onToggle={() => toggle("discordRichPresence")} />
        </SettingsRow>
        <SettingsRow label="Custom Webhook Relay" description="Send real-time JSON events to an HTTP endpoint">
          <Toggle on={props.customWebhookEnabled} onToggle={() => toggle("customWebhookEnabled")} />
        </SettingsRow>
        {props.customWebhookEnabled && (
          <div className="mt-2 ml-1 pl-4 border-l border-white/5">
            <input type="url" value={props.customWebhookUrl} onChange={(e) => u("customWebhookUrl", e.target.value)}
              placeholder="https://your-server.com/webhook" className="input-glass font-mono" />
          </div>
        )}
      </CollapsibleSection>

      {/* Network */}
      <CollapsibleSection title="Network" icon="🌐">
        <SettingsRow label="Auto-Reconnect WebSocket" description="Automatically retry if the connection to the engine drops">
          <Toggle on={props.wsAutoReconnect} onToggle={() => toggle("wsAutoReconnect")} />
        </SettingsRow>
      </CollapsibleSection>

      {/* Updates & Logging */}
      <CollapsibleSection title="Updates & Logging" icon="📓">
        <SettingsRow label="Release Channel" description="Choose between stable, beta, or closed-beta builds">
          <GlassSelect value={props.updateChannel} options={updateChannelOptions} onChange={(v) => u("updateChannel", v as SystemConfig["updateChannel"])} />
        </SettingsRow>
        <SettingsRow label="Log Level" description="Granularity of runtime logging output">
          <GlassSelect value={props.logLevel} options={logLevelOptions} onChange={(v) => u("logLevel", v as SystemConfig["logLevel"])} />
        </SettingsRow>
        <SettingsRow label="Automatic Backups" description="Keep up to 5 backups of config before writing updates">
          <Toggle on={props.configBackupEnabled} onToggle={() => toggle("configBackupEnabled")} />
        </SettingsRow>
      </CollapsibleSection>

      <AdultContentSection />
    </div>
  );
}
