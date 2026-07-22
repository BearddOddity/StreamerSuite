export interface TwitchStats {
  is_live: boolean;
  viewer_count?: number;
  title?: string;
  game_name?: string;
  started_at?: string;
  follower_total?: number;
  subscriber_total?: number;
}

export interface KickStats {
  is_live: boolean;
  viewer_count?: number;
  title?: string;
  category_name?: string;
  started_at?: string;
}

export interface ViewerSample {
  timestamp: number;
  total: number;
}
