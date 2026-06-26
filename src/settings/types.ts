// ─── Unified StreamerSuite Settings ──────────────────────────────────────────
// Merges StreamerSuite core settings + StatusForge.io settings into a single
// canonical type system. All localStorage keys are unified under one provider.

// ── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKeys {
  // Streaming platforms
  twitchClientId: string;
  twitchClientSecret: string;
  twitchAccessToken: string;
  twitchRefreshToken: string;
  twitchBroadcasterId: string;
  kickClientId: string;
  kickClientSecret: string;
  kickChannelId: string;
  kickToken: string;
  kickRefreshToken: string;
  joystickApiKey: string;
  // Metadata / game APIs
  steamgridApiKey: string;
  rawgApiKey: string;
  igdbClientId: string;
  igdbClientSecret: string;
  igdbAccessToken: string;
}

// ── Routing ───────────────────────────────────────────────────────────────────

export type RoutingMode = "streamer_bot" | "native";

export interface RoutingConfig {
  routingMode: RoutingMode;
  sbPort: number;
  sbActionName: string;
  // Per-platform connection preferences
  preferredTwitchMode: "api" | "ws";
  preferredKickMode: "api" | "ws";
  preferredJoystickMode: "api" | "ws";
}

// ── System (merged from StatusForge SystemPrefs + main GeneralTab) ───────────

export interface SystemConfig {
  autoStartEngine: boolean;
  minimizeToTray: boolean;
  launchOnStartup: boolean;
  hardwareAccel: boolean;
  showNotifications: boolean;
  notifyOnGameDetect: boolean;
  notifyOnStreamEvents: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  language: string;
  configBackupEnabled: boolean;
  steamRichPresence: boolean;
  discordRichPresence: boolean;
  customWebhookEnabled: boolean;
  customWebhookUrl: string;
  wsAutoReconnect: boolean;
  autoConnectChannels: boolean;
  updateChannel: "stable" | "beta" | "closed-beta";
}

// ── Theme (merged from StatusForge ThemePrefs + main ThemeTab) ───────────────

export type Density = "compact" | "default" | "spacious";
export type RadiusPreset = "sharp" | "soft" | "rounded";
export type TransitionSpeed = "instant" | "fast" | "normal" | "slow";
export type ThemeMode = "dark" | "light";
export type ChatDensity = "compact" | "normal" | "comfortable";

export interface ThemeConfig {
  accentColor: string;
  themeMode: ThemeMode;
  fontSize: number;
  chatDensity: ChatDensity;
  borderRadius: RadiusPreset;
  showTimestamps: boolean;
  showBadges: boolean;
  chatFontSize: number;
  chatFontFamily: string;
  chatFontWeight: string;
  fontFamily: string;
  fontWeight: string;
  chatBubbles: boolean;
  platformBadges: boolean;
  animationsEnabled: boolean;
  glowEffects: boolean;
  // StatusForge theme additions
  bgColor: string;
  bgOpacity: number;
  bgBlur: number;
  bgImage: string;
  panelOpacity: number;
  fontScale: number;
  density: Density;
  sidebarIconOnly: boolean;
  reducedMotion: boolean;
  transitionSpeed: TransitionSpeed;
  coverBreathe: boolean;
  coverGlint: boolean;
  cardHoverLift: boolean;
  cardGlint: boolean;
  holoEffects: boolean;
  statusPulse: boolean;
  toastAnimations: boolean;
  modalAnimations: boolean;
  progressBarAnimation: boolean;
  buttonHoverEffects: boolean;
}

// ── Detection (from StatusForge) ─────────────────────────────────────────────

export type DetectionMode = "python" | "native" | "spark";

export interface DetectionConfig {
  mode: DetectionMode;
  pythonFallback: boolean;
  scanIntervalSecs: number;
  devToolsEnabled: boolean;
  closedBetaChannel: boolean;
}

// ── Engine Settings (from StatusForge) ───────────────────────────────────────

export interface EngineSettings {
  idleCategory: string;
  scanInterval: number;
  gracePeriod: number;
  widgetPollRate: number;
  widgetFadeTimer: number;
  safeMode: boolean;
  autoPush: boolean;
  strictForgeMode: boolean;
  emulatorDetection: boolean;
  ramThreshold: number;
  processFilterBypass: boolean;
  confidenceThreshold: number;
  // Behavior Trap toggles
  trapChromium: boolean;
  trapCmdline: boolean;
  trapUiFramework: boolean;
  trapGeometry: boolean;
  // Confidence scoring toggles
  scoreEngineDna: boolean;
  scoreFullscreen: boolean;
  scoreWindowTitle: boolean;
  scoreRam: boolean;
  // Spark
  sparkPin: string;
  // Widget
  widgetToken: string;
}

// ── Main unified settings ────────────────────────────────────────────────────

export interface SharedSettings {
  apiKeys: ApiKeys;
  routing: RoutingConfig;
  system: SystemConfig;
  theme: ThemeConfig;
  detection: DetectionConfig;
  engine: EngineSettings;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const defaultSharedSettings: SharedSettings = {
  apiKeys: {
    twitchClientId: "",
    twitchClientSecret: "",
    twitchAccessToken: "",
    twitchRefreshToken: "",
    twitchBroadcasterId: "",
    kickClientId: "",
    kickClientSecret: "",
    kickChannelId: "",
    kickToken: "",
    kickRefreshToken: "",
    joystickApiKey: "",
    steamgridApiKey: "",
    rawgApiKey: "",
    igdbClientId: "",
    igdbClientSecret: "",
    igdbAccessToken: "",
  },
  routing: {
    routingMode: "streamer_bot",
    sbPort: 8080,
    sbActionName: "UpdateCategory",
    preferredTwitchMode: "ws",
    preferredKickMode: "api",
    preferredJoystickMode: "ws",
  },
  system: {
    autoStartEngine: false,
    autoConnectChannels: true,
    minimizeToTray: true,
    launchOnStartup: false,
    hardwareAccel: true,
    showNotifications: true,
    notifyOnGameDetect: true,
    notifyOnStreamEvents: false,
    logLevel: "info",
    language: "en",
    configBackupEnabled: true,
    steamRichPresence: false,
    discordRichPresence: false,
    customWebhookEnabled: false,
    customWebhookUrl: "",
    wsAutoReconnect: true,
    updateChannel: "stable",
  },
  theme: {
    accentColor: "#9146FF",
    themeMode: "dark",
    fontSize: 14,
    chatDensity: "normal",
    borderRadius: "rounded",
    showTimestamps: true,
    showBadges: true,
    chatFontSize: 14,
    chatFontFamily: "Inter, system-ui, sans-serif",
    chatFontWeight: "400",
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: "400",
    chatBubbles: false,
    platformBadges: true,
    animationsEnabled: true,
    glowEffects: true,
    bgColor: "#050505",
    bgOpacity: 100,
    bgBlur: 0,
    bgImage: "",
    panelOpacity: 30,
    fontScale: 100,
    density: "default",
    sidebarIconOnly: false,
    reducedMotion: false,
    transitionSpeed: "normal",
    coverBreathe: true,
    coverGlint: true,
    cardHoverLift: true,
    cardGlint: true,
    holoEffects: true,
    statusPulse: true,
    toastAnimations: true,
    modalAnimations: true,
    progressBarAnimation: true,
    buttonHoverEffects: true,
  },
  detection: {
    mode: "python",
    pythonFallback: true,
    scanIntervalSecs: 5,
    devToolsEnabled: false,
    closedBetaChannel: false,
  },
  engine: {
    idleCategory: "Just Chatting",
    scanInterval: 15,
    gracePeriod: 0,
    widgetPollRate: 8,
    widgetFadeTimer: 15,
    safeMode: false,
    autoPush: false,
    strictForgeMode: false,
    emulatorDetection: true,
    ramThreshold: 80,
    processFilterBypass: false,
    confidenceThreshold: 0.5,
    trapChromium: true,
    trapCmdline: true,
    trapUiFramework: true,
    trapGeometry: true,
    scoreEngineDna: true,
    scoreFullscreen: true,
    scoreWindowTitle: true,
    scoreRam: true,
    sparkPin: "0000",
    widgetToken: "",
  },
};
