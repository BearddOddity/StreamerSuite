import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface ThemeState {
  accentColor: string;
  themeMode: "dark" | "light";
  fontSize: number;
  chatDensity: "compact" | "normal" | "comfortable";
  borderRadius: number;
  showTimestamps: boolean;
  showBadges: boolean;
  animationsEnabled: boolean;
  glowEffects: boolean;
  launchOnStartup: boolean;
  notificationsEnabled: boolean;
  language: string;
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
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "chatconfluence-theme";

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

    // Theme mode
    root.classList.toggle("light-mode", state.themeMode === "light");

    // Animations
    root.classList.toggle("no-animations", !state.animationsEnabled);

    // Glow effects
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
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
