import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { emit } from "@tauri-apps/api/event";
import { defaultSharedSettings, type SharedSettings, type ApiKeys, type RoutingConfig, type SystemConfig, type ThemeConfig, type DetectionConfig, type EngineSettings } from "./types";
import { resolveImageSrc } from "./resolveImageSrc";

// ─── Context value ───────────────────────────────────────────────────────────

interface SharedSettingsContextValue extends SharedSettings {
  // API keys
  setApiKeys: (keys: ApiKeys) => void;
  updateApiKey: (field: keyof ApiKeys, value: string) => void;
  // Routing
  setRouting: (routing: RoutingConfig) => void;
  updateRouting: (field: keyof RoutingConfig, value: RoutingConfig[keyof RoutingConfig]) => void;
  // System
  setSystem: (system: SystemConfig) => void;
  updateSystem: (field: keyof SystemConfig, value: SystemConfig[keyof SystemConfig]) => void;
  // Theme
  setTheme: (theme: ThemeConfig) => void;
  updateTheme: (field: keyof ThemeConfig, value: ThemeConfig[keyof ThemeConfig]) => void;
  // Detection
  setDetection: (detection: DetectionConfig) => void;
  updateDetection: (field: keyof DetectionConfig, value: DetectionConfig[keyof DetectionConfig]) => void;
  // Engine
  setEngine: (engine: EngineSettings) => void;
  updateEngine: (field: keyof EngineSettings, value: EngineSettings[keyof EngineSettings]) => void;
  // Import / merge (for migration from StatusForge standalone)
  mergeFromStatusForge: (sf: Partial<SharedSettings>) => void;
}

const SharedSettingsContext = createContext<SharedSettingsContextValue | null>(null);

// ─── Storage keys ────────────────────────────────────────────────────────────

// Exported so other in-SPA storage adapters (e.g. StatusForge's theme.ts,
// which predates the unified store and used to keep its own parallel
// "statusforge_theme_prefs" key) can read/write the exact same source of
// truth instead of drifting out of sync with it.
export const STORAGE_KEY = "streamersuite-unified-settings";
/** Fired after every write to STORAGE_KEY — including writes from adapters
 *  outside this context (theme.ts) — so this provider's React state stays
 *  in sync with changes made through those other entry points. The native
 *  `storage` event doesn't fire in the same document that made the change,
 *  which is exactly the case here (StatusForge renders in the same SPA/
 *  window), so a plain custom event does the job instead. */
export const SETTINGS_CHANGED_EVENT = "streamersuite-settings-changed";
const LEGACY_KEYS = [
  "streamersuite-shared-settings",
  "streamersuite-theme",
  "statusforge_system_prefs",
  "statusforge_theme_prefs",
  "statusforge_dev_settings",
] as const;

// ─── Migration: pull from old localStorage keys into unified shape ───────────

function migrateLegacy(): Partial<SharedSettings> | null {
  let migrated: Partial<SharedSettings> = {};
  let foundAny = false;

  try {
    const raw = localStorage.getItem("streamersuite-shared-settings");
    if (raw) {
      foundAny = true;
      const parsed = JSON.parse(raw);
      if (parsed.apiKeys) migrated.apiKeys = { ...defaultSharedSettings.apiKeys, ...parsed.apiKeys };
      if (parsed.routing) migrated.routing = { ...defaultSharedSettings.routing, ...parsed.routing };
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem("streamersuite-theme");
    if (raw) {
      foundAny = true;
      const parsed = JSON.parse(raw);
      migrated.theme = {
        ...defaultSharedSettings.theme,
        accentColor: parsed.accentColor ?? defaultSharedSettings.theme.accentColor,
        themeMode: parsed.themeMode ?? defaultSharedSettings.theme.themeMode,
        fontSize: parsed.fontSize ?? defaultSharedSettings.theme.fontSize,
        chatDensity: parsed.chatDensity ?? defaultSharedSettings.theme.chatDensity,
        borderRadius: (parsed.borderRadius != null ? (parsed.borderRadius === 0 ? "sharp" : parsed.borderRadius <= 8 ? "soft" : "rounded") : defaultSharedSettings.theme.borderRadius),
        showTimestamps: parsed.showTimestamps ?? defaultSharedSettings.theme.showTimestamps,
        showBadges: parsed.showBadges ?? defaultSharedSettings.theme.showBadges,
        animationsEnabled: parsed.animationsEnabled ?? defaultSharedSettings.theme.animationsEnabled,
        glowEffects: parsed.glowEffects ?? defaultSharedSettings.theme.glowEffects,
      };
      // Also carry over system fields that lived in ThemeContext
      migrated.system = {
        ...defaultSharedSettings.system,
        launchOnStartup: parsed.launchOnStartup ?? defaultSharedSettings.system.launchOnStartup,
        showNotifications: parsed.notificationsEnabled ?? defaultSharedSettings.system.showNotifications,
        language: parsed.language ?? defaultSharedSettings.system.language,
        updateChannel: parsed.updateChannel ?? defaultSharedSettings.system.updateChannel,
        hardwareAccel: parsed.hardwareAccel ?? defaultSharedSettings.system.hardwareAccel,
        minimizeToTray: parsed.minimizeToTray ?? defaultSharedSettings.system.minimizeToTray,
        autoStartEngine: parsed.autoStartEngine ?? defaultSharedSettings.system.autoStartEngine,
        steamRichPresence: parsed.steamRichPresence ?? defaultSharedSettings.system.steamRichPresence,
        discordRichPresence: parsed.discordRichPresence ?? defaultSharedSettings.system.discordRichPresence,
        customWebhookEnabled: parsed.customWebhookEnabled ?? defaultSharedSettings.system.customWebhookEnabled,
        customWebhookUrl: parsed.customWebhookUrl ?? defaultSharedSettings.system.customWebhookUrl,
        wsAutoReconnect: parsed.wsAutoReconnect ?? defaultSharedSettings.system.wsAutoReconnect,
        logLevel: parsed.logLevel ?? defaultSharedSettings.system.logLevel,
        configBackupEnabled: parsed.configBackupEnabled ?? defaultSharedSettings.system.configBackupEnabled,
      };
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem("statusforge_system_prefs");
    if (raw) {
      foundAny = true;
      const p = JSON.parse(raw);
      migrated.system = {
        ...defaultSharedSettings.system,
        ...migrated.system,
        autoStartEngine: p.autoStartEngine ?? defaultSharedSettings.system.autoStartEngine,
        minimizeToTray: p.minimizeToTray ?? defaultSharedSettings.system.minimizeToTray,
        launchOnStartup: p.launchOnLogin ?? defaultSharedSettings.system.launchOnStartup,
        hardwareAccel: p.hardwareAccel ?? defaultSharedSettings.system.hardwareAccel,
        showNotifications: p.showNotifications ?? defaultSharedSettings.system.showNotifications,
        notifyOnGameDetect: p.notifyOnGameDetect ?? defaultSharedSettings.system.notifyOnGameDetect,
        notifyOnStreamEvents: p.notifyOnStreamEvents ?? defaultSharedSettings.system.notifyOnStreamEvents,
        logLevel: p.logLevel ?? defaultSharedSettings.system.logLevel,
        language: p.language ?? defaultSharedSettings.system.language,
        configBackupEnabled: p.configBackupEnabled ?? defaultSharedSettings.system.configBackupEnabled,
        steamRichPresence: p.steamRichPresence ?? defaultSharedSettings.system.steamRichPresence,
        discordRichPresence: p.discordRichPresence ?? defaultSharedSettings.system.discordRichPresence,
        customWebhookEnabled: p.customWebhookEnabled ?? defaultSharedSettings.system.customWebhookEnabled,
        customWebhookUrl: p.customWebhookUrl ?? defaultSharedSettings.system.customWebhookUrl,
        wsAutoReconnect: p.wsAutoReconnect ?? defaultSharedSettings.system.wsAutoReconnect,
        updateChannel: p.updateChannel ?? defaultSharedSettings.system.updateChannel,
      };
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem("statusforge_theme_prefs");
    if (raw) {
      foundAny = true;
      const p = JSON.parse(raw);
      migrated.theme = {
        ...defaultSharedSettings.theme,
        ...migrated.theme,
        accentColor: p.accentColor ?? defaultSharedSettings.theme.accentColor,
        bgColor: p.bgColor ?? defaultSharedSettings.theme.bgColor,
        bgOpacity: p.bgOpacity ?? defaultSharedSettings.theme.bgOpacity,
        bgBlur: p.bgBlur ?? defaultSharedSettings.theme.bgBlur,
        bgImage: p.bgImage ?? defaultSharedSettings.theme.bgImage,
        panelOpacity: p.panelOpacity ?? defaultSharedSettings.theme.panelOpacity,
        borderRadius: p.borderRadius ?? defaultSharedSettings.theme.borderRadius,
        fontScale: p.fontScale ?? defaultSharedSettings.theme.fontScale,
        density: p.density ?? defaultSharedSettings.theme.density,
        sidebarIconOnly: p.sidebarIconOnly ?? defaultSharedSettings.theme.sidebarIconOnly,
        animationsEnabled: p.animationsEnabled ?? defaultSharedSettings.theme.animationsEnabled,
        reducedMotion: p.reducedMotion ?? defaultSharedSettings.theme.reducedMotion,
        transitionSpeed: p.transitionSpeed ?? defaultSharedSettings.theme.transitionSpeed,
        coverBreathe: p.coverBreathe ?? defaultSharedSettings.theme.coverBreathe,
        coverGlint: p.coverGlint ?? defaultSharedSettings.theme.coverGlint,
        cardHoverLift: p.cardHoverLift ?? defaultSharedSettings.theme.cardHoverLift,
        cardGlint: p.cardGlint ?? defaultSharedSettings.theme.cardGlint,
        holoEffects: p.holoEffects ?? defaultSharedSettings.theme.holoEffects,
        statusPulse: p.statusPulse ?? defaultSharedSettings.theme.statusPulse,
        toastAnimations: p.toastAnimations ?? defaultSharedSettings.theme.toastAnimations,
        modalAnimations: p.modalAnimations ?? defaultSharedSettings.theme.modalAnimations,
        progressBarAnimation: p.progressBarAnimation ?? defaultSharedSettings.theme.progressBarAnimation,
        buttonHoverEffects: p.buttonHoverEffects ?? defaultSharedSettings.theme.buttonHoverEffects,
      };
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem("statusforge_dev_settings");
    if (raw) {
      foundAny = true;
      const p = JSON.parse(raw);
      migrated.detection = {
        ...defaultSharedSettings.detection,
        devToolsEnabled: p.devToolsEnabled ?? defaultSharedSettings.detection.devToolsEnabled,
        closedBetaChannel: p.closedBetaChannel ?? defaultSharedSettings.detection.closedBetaChannel,
      };
    }
  } catch { /* ignore */ }

  return foundAny ? migrated : null;
}

// ─── Load / merge ────────────────────────────────────────────────────────────

// A previously-stored oversized wallpaper (from before uploads went
// through compressImage, or from testing an earlier build) can make every
// future write fail with QuotaExceededError before the write-time recovery
// in the persist effect ever gets a chance to run — the corrupted value
// just sits there forever. Stripping it here, at load time, means a
// profile carrying old bloated data self-heals on the very next launch
// instead of staying permanently stuck with settings that appear to do
// nothing. Set well above what compressImage's 1920px/JPEG@85% output
// normally produces (typically a few hundred KB), so it only ever catches
// genuinely oversized/corrupted values, not legitimate compressed photos.
const MAX_BG_IMAGE_CHARS = 3_000_000;
function sanitizeLoaded(settings: SharedSettings): SharedSettings {
  if (settings.theme?.bgImage && settings.theme.bgImage.length > MAX_BG_IMAGE_CHARS) {
    return { ...settings, theme: { ...settings.theme, bgImage: "" } };
  }
  return settings;
}

function load(): SharedSettings {
  // 1. Try unified key first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return sanitizeLoaded(deepMerge(defaultSharedSettings, parsed) as SharedSettings);
    }
  } catch { /* ignore */ }

  // 2. Migrate from legacy keys
  const legacy = migrateLegacy();
  if (legacy) {
    const merged = deepMerge(defaultSharedSettings, legacy) as SharedSettings;
    // Persist migrated result
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
    // Clean up old keys
    LEGACY_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
    return merged;
  }

  // 3. Fresh defaults
  return defaultSharedSettings;
}

// Deep merge helper (objects only, arrays replaced)
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function SharedSettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SharedSettings>(load);
  // Tracks the JSON this provider itself last wrote, so its own
  // SETTINGS_CHANGED_EVENT echo (below) can be told apart from a write made
  // by another adapter (StatusForge's theme.ts) — otherwise every change
  // would reload+rewrite+redispatch itself forever.
  const lastWrittenRef = useRef<string | null>(null);

  // Persist on every change. A failed write here (almost always
  // QuotaExceededError from an oversized bgImage data URI — see
  // ThemeTab.tsx) must not be allowed to silently kill persistence for
  // every *other* setting too: fall back to dropping the one field most
  // likely responsible and retry, rather than losing the whole write.
  useEffect(() => {
    const json = JSON.stringify(state);
    lastWrittenRef.current = json;
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      console.error("Failed to persist settings, retrying without background image:", err);
      if (state.theme.bgImage) {
        setState((s) => ({ ...s, theme: { ...s.theme, bgImage: "" } }));
        return; // the state update above re-triggers this effect with a smaller payload
      }
      lastWrittenRef.current = null;
    }
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  }, [state]);

  // Pick up writes made through other adapters onto the same STORAGE_KEY
  // (StatusForge's theme.ts) without requiring them to route through this
  // context — otherwise this provider's in-memory state would silently
  // fall behind whatever StatusForge's own Theme tab just saved.
  useEffect(() => {
    const onExternalChange = () => {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current === lastWrittenRef.current) return; // our own echo
      setState(load());
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onExternalChange);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onExternalChange);
  }, []);

  // Apply CSS custom properties for theme
  useEffect(() => {
    const root = document.documentElement;
    const t = state.theme;
    root.style.setProperty("--accent-system", t.accentColor);
    root.style.setProperty("--font-size-base", `${t.fontSize}px`);
    root.style.setProperty("--border-radius", t.borderRadius === "sharp" ? "2px" : t.borderRadius === "soft" ? "8px" : "16px");
    root.style.setProperty("--chat-density", t.chatDensity === "compact" ? "0.25rem" : t.chatDensity === "comfortable" ? "0.75rem" : "0.5rem");
    root.style.setProperty("--user-accent", t.accentColor);
    root.style.setProperty("--user-bg", t.bgColor);
    root.style.setProperty("--user-bg-opacity", String(t.bgOpacity / 100));
    root.style.setProperty("--user-bg-blur", `${t.bgBlur}px`);
    root.style.setProperty("--user-bg-image", t.bgImage ? `url(${resolveImageSrc(t.bgImage)})` : "none");
    root.style.setProperty("--user-panel-opacity", String(t.panelOpacity / 100));
    root.style.setProperty("--user-font-scale", String(t.fontScale / 100));
    root.style.setProperty("--user-radius", t.borderRadius === "sharp" ? "2px" : t.borderRadius === "soft" ? "8px" : "16px");
    root.style.setProperty("--user-density", t.density === "compact" ? "0.75rem" : t.density === "spacious" ? "1.5rem" : "1rem");
    const animOff = !t.animationsEnabled || t.reducedMotion;
    root.style.setProperty("--user-anim-duration", animOff ? "0s" : "unset");
    root.style.setProperty("--user-reduced-motion", t.reducedMotion ? "true" : "false");
    root.style.setProperty("--user-transition-speed", animOff ? "0s" : { instant: "0s", fast: "0.1s", normal: "0.2s", slow: "0.4s" }[t.transitionSpeed]);
    root.style.setProperty("--user-cover-breathe", t.coverBreathe && !animOff ? "unset" : "none");
    root.style.setProperty("--user-cover-glint", t.coverGlint && !animOff ? "unset" : "none");
    root.style.setProperty("--user-card-lift", t.cardHoverLift && !animOff ? "unset" : "none");
    root.style.setProperty("--user-card-glint", t.cardGlint && !animOff ? "unset" : "none");
    root.style.setProperty("--user-font-family", t.fontFamily);
    root.style.setProperty("--user-font-weight", t.fontWeight);
    root.style.setProperty("--user-chat-font-size", `${t.chatFontSize}px`);
    root.style.setProperty("--user-chat-font-family", t.chatFontFamily);
    root.style.setProperty("--user-chat-font-weight", t.chatFontWeight);
    root.style.setProperty("--user-holo-opacity", t.holoEffects && !animOff ? "1" : "0");
    root.style.setProperty("--user-status-pulse", t.statusPulse && !animOff ? "unset" : "none");
    root.style.setProperty("--user-toast-anim", t.toastAnimations && !animOff ? "unset" : "none");
    root.style.setProperty("--user-modal-anim", t.modalAnimations && !animOff ? "unset" : "none");
    root.style.setProperty("--user-progress-anim", t.progressBarAnimation && !animOff ? "unset" : "none");
    root.style.setProperty("--user-btn-hover", t.buttonHoverEffects && !animOff ? "unset" : "none");
    root.classList.toggle("light-mode", t.themeMode === "light");
    root.classList.toggle("no-animations", !t.animationsEnabled);
    root.classList.toggle("no-glow", !t.glowEffects);
    root.classList.toggle("chat-bubbles", t.chatBubbles);
    root.classList.toggle("no-platform-badges", !t.platformBadges);

    // Multi-Chat runs in its own window/webview (separate localStorage), so
    // it can't just read this window's settings — push the accent over a
    // Tauri event instead. No-op there if the window doesn't exist yet.
    emit("streamersuite://theme-accent", { accentColor: t.accentColor }).catch(() => {});
  }, [state.theme]);

  // Helpers
  const updateSection = useCallback(<K extends keyof SharedSettings>(section: K, field: keyof SharedSettings[K], value: any) => {
    setState((s) => ({ ...s, [section]: { ...s[section], [field]: value } }));
  }, []);

  const value: SharedSettingsContextValue = {
    ...state,
    // API keys
    setApiKeys: (keys) => setState((s) => ({ ...s, apiKeys: keys })),
    updateApiKey: (field, value) => updateSection("apiKeys", field, value),
    // Routing
    setRouting: (routing) => setState((s) => ({ ...s, routing })),
    updateRouting: (field, value) => updateSection("routing", field, value),
    // System
    setSystem: (system) => setState((s) => ({ ...s, system })),
    updateSystem: (field, value) => updateSection("system", field, value),
    // Theme
    setTheme: (theme) => setState((s) => ({ ...s, theme })),
    updateTheme: (field, value) => updateSection("theme", field, value),
    // Detection
    setDetection: (detection) => setState((s) => ({ ...s, detection })),
    updateDetection: (field, value) => updateSection("detection", field, value),
    // Engine
    setEngine: (engine) => setState((s) => ({ ...s, engine })),
    updateEngine: (field, value) => updateSection("engine", field, value),
    // Merge
    mergeFromStatusForge: (sf) => setState((s) => deepMerge(s, sf) as SharedSettings),
  };

  return <SharedSettingsContext.Provider value={value}>{children}</SharedSettingsContext.Provider>;
}

export function useSharedSettings() {
  const ctx = useContext(SharedSettingsContext);
  if (!ctx) throw new Error("useSharedSettings must be used within SharedSettingsProvider");
  return ctx;
}
