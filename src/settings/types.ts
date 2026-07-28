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
  joystickApplicationId: string;
  joystickClientId: string;
  joystickClientSecret: string;
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
  // StatusForge-only extras (surfaced only in StatusForge's own Settings ->
  // System sub-tab, not in StreamerSuite's centralized General tab) — kept
  // in the unified store so they persist through the same storage/sync
  // mechanism as everything else, instead of a private localStorage key
  // that could silently drift out of sync.
  autoUpdateCheckEnabled: boolean;
  showDevTools: boolean;
  showAccessTokens: boolean;
  onboardingComplete: boolean;
  setupBannerDismissed: boolean;
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

// ── Main unified settings ────────────────────────────────────────────────────

export interface SharedSettings {
  apiKeys: ApiKeys;
  routing: RoutingConfig;
  system: SystemConfig;
  theme: ThemeConfig;
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
    joystickApplicationId: "",
    joystickClientId: "",
    joystickClientSecret: "",
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
    autoUpdateCheckEnabled: true,
    showDevTools: false,
    showAccessTokens: false,
    onboardingComplete: false,
    setupBannerDismissed: false,
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
    chatFontFamily: "Montserrat, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, sans-serif",
    chatFontWeight: "400",
    fontFamily: "Montserrat, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, sans-serif",
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
};
