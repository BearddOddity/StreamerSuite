export interface KickBadge {
  text: string;
  type: string;
  count?: number;
}

export interface KickSender {
  id: number;
  username: string;
  color?: string;
  badges?: KickBadge[];
}

export interface KickChatMessage {
  id: string;
  content: string;
  created_at?: string;
  sender?: KickSender;
}

export interface KickChannel {
  id: number;
  slug: string;
  user_id?: number;
  [key: string]: unknown;
}

export interface KickDocPage {
  title: string;
  slug: string;
  section: string;
  path: string;
  url: string;
}
