export type AlertPlatform = "twitch" | "kick" | "joystick";
export type AlertKind = "follow" | "sub" | "raid" | "cheer" | "tip";

export interface AlertEvent {
  id: string;
  platform: AlertPlatform;
  kind: AlertKind;
  user: string;
  message: string;
  amount?: string;
  timestamp: number;
}

export interface AlertsSettings {
  kickSlug: string;
  enabled: {
    twitchFollow: boolean;
    twitchSub: boolean;
    twitchRaid: boolean;
    twitchCheer: boolean;
    kickSub: boolean;
    kickHost: boolean;
    joystickTip: boolean;
  };
  soundEnabled: boolean;
}

export const defaultAlertsSettings: AlertsSettings = {
  kickSlug: "",
  enabled: {
    twitchFollow: true,
    twitchSub: true,
    twitchRaid: true,
    twitchCheer: true,
    kickSub: true,
    kickHost: true,
    joystickTip: true,
  },
  soundEnabled: true,
};

export interface TwitchAccount {
  username: string;
  user_id: string;
}
