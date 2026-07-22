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
