/**
 * Phase 10 — Type definitions used across the UI. Pure types only; no
 * runtime values live here. `lib/mock-data.ts` was deleted in Phase 10,
 * so anywhere that needs concrete data should read from `lib/db/*`
 * (Supabase) or accept it as a prop.
 *
 * The names mirror the original prototype shapes so downstream
 * components keep compiling without sweeping prop renames.
 */

export type Category =
  | "politics"
  | "crypto"
  | "sports"
  | "tech"
  | "economy"
  | "entertainment";

export const CATEGORIES: Category[] = [
  "politics",
  "crypto",
  "sports",
  "tech",
  "economy",
  "entertainment",
];

export type ExpertScores = Partial<Record<Category, number>>;

export interface User {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  bio: string;
  joined: string;
  followers: number;
  following: number;
  totalPredictions: number;
  pointsWon: number;
  expertScores: ExpertScores;
  brierScores: Partial<Record<Category, number>>;
  predictionsByCategory: Partial<Record<Category, number>>;
  primaryCategory: Category;
  verified: boolean;
  calibration: {
    bucket: number;
    predicted: number;
    actual: number;
    count: number;
  }[];
}

export interface Market {
  id: string;
  question: string;
  description: string;
  category: Category;
  resolutionDate: string;
  resolutionSource: string;
  createdAt: string;
  currentYesPrice: number;
  currentNoPrice: number;
  volume24h: number;
  totalVolume: number;
  traders: number;
  priceHistory: { timestamp: string; yesPrice: number }[];
  topHolders: {
    yes: { userId: string; shares: number; avgPrice: number }[];
    no: { userId: string; shares: number; avgPrice: number }[];
  };
  imageUrl?: string;
}

export interface PostBase {
  id: string;
  userId: string;
  createdAt: string;
  body: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface PredictionPost extends PostBase {
  type: "prediction";
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  avgPrice: number;
  staked: number;
  pnl?: number;
  pnlPct?: number;
}

export interface MarketPost extends PostBase {
  type: "market";
  marketId: string;
}

export interface MarketLaunchPost extends PostBase {
  type: "launch";
  marketId: string;
}

export interface GeneralPost extends PostBase {
  type: "general";
  category?: Category;
}

export type Post = PredictionPost | MarketPost | MarketLaunchPost | GeneralPost;

export interface Trade {
  id: string;
  marketId: string;
  userId: string;
  side: "YES" | "NO";
  shares: number;
  price: number;
  timestamp: string;
}

export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  body: string;
  createdAt: string;
  likes: number;
  position?: { side: "YES" | "NO"; shares: number; avgPrice: number };
}

export interface SeededComment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  likes: number;
  parentId?: string | null;
}

export interface Notification {
  id: string;
  type: "trade" | "follow" | "resolution" | "comment";
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
}

export const CURRENT_USER_ID = "u-current";
