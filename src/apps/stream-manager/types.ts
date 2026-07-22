export interface TwitchChannelInfo {
  title: string;
  game_name: string;
  game_id: string;
  tags: string[];
  broadcaster_language: string;
}

export interface KickChannelInfo {
  stream_title?: string;
  category?: { id: number; name: string };
  custom_tags?: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  custom: boolean;
}

export const DEFAULT_CHECKLIST_LABELS = [
  "Mic levels checked",
  "Camera focused & lit",
  "Scene set to Starting Soon",
  "Title & category set",
  "Overlays visible in OBS/Meld",
  "Alerts test fired",
  "Chat connected",
  "Recording backup on (if used)",
];
