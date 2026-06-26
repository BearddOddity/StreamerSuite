import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface ThemeState {
  // Appearance
  accentColor: string;
  themeMode: "dark" | "light";
  fontSize: number;
  chatDensity: "compact" | "normal" | "comfortable";
  borderRadius: number;
  showTimestamps: boolean;
  showBadges: boolean;
  animationsEnabled: boolean;
  glowEffects: boolean;
  // System
  launchOnStartup: boolean;
  notificationsEnabled: boolean;
  language: string;
  updateChannel: "stable" | "beta" | "closed-beta";
  hardwareAccel: boolean;
  minimizeToTray: boolean;
  autoStartEngine: boolean;
  // Rich presence / integrations
  steamRichPresence: boolean;
  discordRichPresence: boolean;
  customWebhookEnabled: boolean;
  customWebhookUrl: string;
  wsAutoReconnect: boolean;
  // Logging
  logLevel: "error" | "warn" | "info" | "debug";
  configBackupEnabled: boolean;
}

interface ThemeContextValue extends ThemeState {
  setAccentColor: (v: string) => void;
  setThemeMode: (v: "dark" | "light") => void;
  setFontSize: (v: number) => void;
  setChatDensity: (v: "compact" | "normal" | "comfortable") => void;
  setBorderRadius: (v: number) => void;
  setShowTimestamps: (v: boolean) => void;
  setShowBadges: (v: boolean) => void;
  setAnimationsEnabled: (v: boolean) => void;
  setGlowEffects: (v: boolean) => void;
  setLaunchOnStartup: (v: boolean) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setLanguage: (v: string) => void;
  setUpdateChannel: (v: "stable" | "beta" | "closed-beta") => void;
  setHardwareAccel: (v: boolean) => void;
  setMinimizeToTray: (v: boolean) => void;
  setAutoStartEngine: (v: boolean) => void;
  setSteamRichPresence: (v: boolean) => void;
  setDiscordRichPresence: (v: boolean) => void;
  setCustomWebhookEnabled: (v: boolean) => void;
  setCustomWebhookUrl: (v: string) => void;
  setWsAutoReconnect: (v: boolean) => void;
  setLogLevel: (v: "error" | "warn" | "info" | "debug") => void;
  setConfigBackupEnabled: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "streamersuite-theme";

function loadState(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ThemeState;
  } catch { /* ignore */ }
  return {
    accentColor: "#9146ff",
    themeMode: "dark",
    fontSize: 14,
    chatDensity: "normal",
    borderRadius: 12,
    showTimestamps: true,
    showBadges: true,
    animationsEnabled: true,
    glowEffects: true,
    launchOnStartup: false,
    notificationsEnabled: true,
    language: "en",
    updateChannel: "stable",
    hardwareAccel: true,
    minimizeToTray: true,
    autoStartEngine: false,
    steamRichPresence: false,
    discordRichPresence: false,
    customWebhookEnabled: false,
    customWebhookUrl: "",
    wsAutoReconnect: true,
    logLevel: "info",
    configBackupEnabled: true,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Apply CSS custom properties to :root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-system", state.accentColor);
    root.style.setProperty("--font-size-base", `${state.fontSize}px`);
    root.style.setProperty("--border-radius", `${state.borderRadius}px`);
    root.style.setProperty("--chat-density", state.chatDensity === "compact" ? "0.25rem" : state.chatDensity === "comfortable" ? "0.75rem" : "0.5rem");
    root.classList.toggle("light-mode", state.themeMode === "light");
    root.classList.toggle("no-animations", !state.animationsEnabled);
    root.classList.toggle("no-glow", !state.glowEffects);
  }, [state]);

  const value: ThemeContextValue = {
    ...state,
    setAccentColor: (v) => setState((s) => ({ ...s, accentColor: v })),
    setThemeMode: (v) => setState((s) => ({ ...s, themeMode: v })),
    setFontSize: (v) => setState((s) => ({ ...s, fontSize: v })),
    setChatDensity: (v) => setState((s) => ({ ...s, chatDensity: v })),
    setBorderRadius: (v) => setState((s) => ({ ...s, borderRadius: v })),
    setShowTimestamps: (v) => setState((s) => ({ ...s, showTimestamps: v })),
    setShowBadges: (v) => setState((s) => ({ ...s, showBadges: v })),
    setAnimationsEnabled: (v) => setState((s) => ({ ...s, animationsEnabled: v })),
    setGlowEffects: (v) => setState((s) => ({ ...s, glowEffects: v })),
    setLaunchOnStartup: (v) => setState((s) => ({ ...s, launchOnStartup: v })),
    setNotificationsEnabled: (v) => setState((s) => ({ ...s, notificationsEnabled: v })),
    setLanguage: (v) => setState((s) => ({ ...s, language: v })),
    setUpdateChannel: (v) => setState((s) => ({ ...s, updateChannel: v })),
    setHardwareAccel: (v) => setState((s) => ({ ...s, hardwareAccel: v })),
    setMinimizeToTray: (v) => setState((s) => ({ ...s, minimizeToTray: v })),
    setAutoStartEngine: (v) => setState((s) => ({ ...s, autoStartEngine: v })),
    setSteamRichPresence: (v) => setState((s) => ({ ...s, steamRichPresence: v })),
    setDiscordRichPresence: (v) => setState((s) => ({ ...s, discordRichPresence: v })),
    setCustomWebhookEnabled: (v) => setState((s) => ({ ...s, customWebhookEnabled: v })),
    setCustomWebhookUrl: (v) => setState((s) => ({ ...s, customWebhookUrl: v })),
    setWsAutoReconnect: (v) => setState((s) => ({ ...s, wsAutoReconnect: v })),
    setLogLevel: (v) => setState((s) => ({ ...s, logLevel: v })),
    setConfigBackupEnabled: (v) => setState((s) => ({ ...s, configBackupEnabled: v })),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
