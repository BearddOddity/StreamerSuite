// Platform-agnostic shapes used by App.tsx and the connection hook. Both
// MeldClient and ObsClient normalize their native data into these so the UI
// never has to branch on which platform it's talking to.
export interface MeldScene {
  id: string;
  name: string;
  index: number;
  current: boolean;
  staged: boolean;
}

export interface MeldTrack {
  id: string;
  name: string;
  muted: boolean;
  monitoring: boolean;
}

export type MeldConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// --- Scene Switcher's own local settings (platform pick + OBS connection) ---
// This is deliberately NOT part of the app-wide "Connections & Keys" tab
// (src/components/settings/ApiKeysTab.tsx) — that tab is reserved for
// credentials shared across multiple tools, and nothing else in
// StreamerSuite needs an OBS WebSocket host/port/password.
export type ScenePlatform = "meld" | "obs";

export interface SceneSwitcherSettings {
  platform: ScenePlatform;
  obsHost: string;
  obsPort: number;
  obsPassword: string;
}

export const defaultSceneSwitcherSettings: SceneSwitcherSettings = {
  platform: "meld",
  obsHost: "127.0.0.1",
  obsPort: 4455,
  obsPassword: "",
};
