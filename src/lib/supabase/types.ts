// Lean hand-rolled Database type. Replace with `supabase gen types typescript`
// output once the project is provisioned. Field names mirror 0001_init.sql.

export type CategorySlug =
  | "politics"
  | "crypto"
  | "sports"
  | "tech"
  | "economy"
  | "entertainment"
  | "general";

export type Side = "yes" | "no";
export type MarketStatus = "open" | "resolved" | "cancelled";
export type MarketOutcome = "yes" | "no" | null;
export type TradeAction = "buy" | "sell";

export interface ProfileRow {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_gradient: string | null;
  /** Phase 11+ — uploaded 3:1 profile banner. Wins over cover_gradient when set. */
  banner_url: string | null;
  /** Phase 11+ — 'user' | 'admin'. Only ADMIN_USER_ID may hold 'admin'. */
  role: "user" | "admin";
  zaps: number;
  total_predictions: number;
  affinity: Record<string, number> | null;
  onboarded: boolean;
  /** Phase 11+ — streak columns from migration 0003 */
  current_streak: number;
  longest_streak: number;
  last_active_day: string | null;
  recoveries_available: number;
  recovery_history: string[];
  pending_recovery_for: string | null;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  slug: CategorySlug;
  name: string;
  color: string;
  icon: string;
}

export interface MarketRow {
  id: string;
  question: string;
  description: string | null;
  category_id: string;
  resolution_date: string;
  resolution_source: string | null;
  yes_price: number;
  no_price: number;
  total_volume: number;
  status: MarketStatus;
  outcome: MarketOutcome;
  hero_image_url: string | null;
  created_at: string;
  created_by: string | null;
}

export interface PositionRow {
  id: string;
  user_id: string;
  market_id: string;
  side: Side;
  shares: number;
  avg_price: number;
  created_at: string;
}

export interface TradeRow {
  id: string;
  user_id: string;
  market_id: string;
  side: Side;
  action: TradeAction;
  shares: number;
  price: number;
  created_at: string;
}

export interface PostRow {
  id: string;
  author_id: string;
  body_html: string;
  category_id: string;
  market_id: string | null;
  images: string[];
  likes: number;
  comments_count: number;
  shares: number;
  boost_zaps: number;
  boost_until: string | null;
  exposure_score: number;
  throttled: boolean;
  created_at: string;
}

export interface PostImpressionRow {
  post_id: string;
  user_id: string | null;
  dwell_ms: number;
  clicked: boolean;
  created_at: string;
}

export interface BoostEventRow {
  id: string;
  post_id: string;
  user_id: string;
  zaps: number;
  duration_h: 1 | 4 | 24;
  starts_at: string;
  ends_at: string;
  early_stopped_at: string | null;
  created_at: string;
}

export interface PostThrottleEventRow {
  id: string;
  post_id: string;
  author_id: string;
  reason: string;
  created_at: string;
}

export interface AuthorCooldownRow {
  user_id: string;
  started_at: string;
  ends_at: string;
  reason: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  likes: number;
  created_at: string;
}

export interface FollowRow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export interface BookmarkRow {
  id: string;
  user_id: string;
  post_id: string | null;
  market_id: string | null;
  created_at: string;
}

export interface ExpertScoreRow {
  user_id: string;
  category_id: string;
  brier: number;
  calibration: number;
  volume: number;
  percentile: number;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface DraftRow {
  id: string;
  user_id: string;
  body_html: string;
  category_id: string | null;
  market_id: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface PostLikeRow {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface CommentLikeRow {
  user_id: string;
  comment_id: string;
  created_at: string;
}

type RW<R, I = Partial<R>, U = Partial<R>> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: RW<ProfileRow, Partial<ProfileRow> & { id: string; username: string; name: string }>;
      categories: RW<CategoryRow>;
      markets: RW<MarketRow>;
      positions: RW<PositionRow>;
      trades: RW<TradeRow>;
      posts: RW<PostRow>;
      post_impressions: RW<PostImpressionRow>;
      boost_events: RW<BoostEventRow>;
      post_throttle_events: RW<PostThrottleEventRow>;
      author_cooldowns: RW<AuthorCooldownRow>;
      comments: RW<CommentRow>;
      follows: RW<FollowRow>;
      bookmarks: RW<BookmarkRow>;
      post_likes: RW<PostLikeRow>;
      comment_likes: RW<CommentLikeRow>;
      expert_scores: RW<ExpertScoreRow>;
      notifications: RW<NotificationRow>;
      drafts: RW<DraftRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      side: Side;
      market_status: MarketStatus;
      market_outcome: "yes" | "no";
      trade_action: TradeAction;
    };
    CompositeTypes: Record<string, never>;
  };
}
