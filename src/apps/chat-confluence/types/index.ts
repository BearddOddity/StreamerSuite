export type Platform = "twitch" | "kick" | "joystick";
export type ConnectionMode = "api" | "ws";

export interface PlatformConfig {
  id: Platform;
  label: string;
  color: string;
  enabled: boolean;
}

export interface ChatUser {
  id: string;
  username: string;
  displayName: string;
  color: string;
  badges: ChatBadge[];
  avatarUrl?: string;
}

export interface ChatBadge {
  text: string;
  type: string;
  count?: number;
}

export interface ChatMessage {
  id: string;
  platform: Platform;
  user: ChatUser;
  content: string;
  timestamp: number;
  isDeleted: boolean;
  replyTo?: {
    messageId: string;
    content: string;
    sender: ChatUser;
  };
}

export interface ChatChannel {
  platform: Platform;
  channelId: string;
  channelName: string;
  isConnected: boolean;
  isLive: boolean;
  viewerCount?: number;
  connectionMode: ConnectionMode;
}

export interface AppState {
  channels: ChatChannel[];
  messages: ChatMessage[];
  activeChannel: string | null;
  isConnecting: boolean;
  isMultiChat: boolean;
}
