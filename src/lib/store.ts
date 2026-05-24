"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { markets, posts as seedPosts, recentTrades } from "./fixtures";
import type { Trade, Post, Category } from "./types";
import {
  updateAffinity,
  checkThrottle,
  type AffinitySignal,
} from "./exposure";

export interface Position {
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  avgPrice: number;
  staked: number;
  openedAt: string;
}

export interface UserTrade extends Trade {
  isMine?: boolean;
}

export interface LocalDraft {
  id: string;
  bodyHtml: string;
  category?: Category | "";
  marketId?: string;
  images?: string[];
  updatedAt: string;
}

export interface UserComment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  likes: number;
  /**
   * Phase 5: parent_id chain for nested threads. Null/undefined = top-level
   * reply on the post.
   */
  parentId?: string | null;
}

export interface UserPost {
  id: string;
  type: "user";
  userId: string;
  createdAt: string;
  body: string;
  category?: Category;
  marketId?: string;
  images?: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  isMine?: boolean;
  // Phase 6 — exposure / boost / throttle
  boostZaps?: number;
  boostUntil?: string | null;
  impressions?: number;
  clicks?: number;
  throttled?: boolean;
  boostEarlyStoppedAt?: string | null;
}

export interface ProfileOverride {
  name?: string;
  bio?: string;
  avatarSeed?: string;
  avatarGradient?: string;
}

interface ZapState {
  // Identity / balance
  points: number;
  totalPredictions: number;

  // Profile overrides for current user
  profileOverride: ProfileOverride;

  // Social
  followingUserIds: string[];
  subscribedUserIds: string[];

  // Positions
  positions: Position[];

  // Engagement
  likedPostIds: string[];
  likedCommentIds: string[];
  bookmarkedPostIds: string[];
  savedMarketIds: string[];

  // Phase 6 — exposure ranking, viewer affinity, author throttle state
  affinity: Record<string, number>;
  throttleEventsAt: string[]; // ISO timestamps of recent author throttles
  cooldownEndsAt: string | null;
  postImpressions: Record<string, number>;
  postClicks: Record<string, number>;

  // User-created
  userPosts: UserPost[];
  commentsByPostId: Record<string, UserComment[]>;

  // Phase 7 — local drafts (prototype fallback when Supabase isn't wired)
  drafts: LocalDraft[];

  // Live data (not persisted)
  marketPrices: Record<
    string,
    { yes: number; no: number; volume: number; flash?: "up" | "down" | null }
  >;
  recentTrades: UserTrade[];

  // Notifications
  unreadNotifications: number;
  notificationsOpen: boolean;

  // Onboarding
  onboarded: boolean;
  onboardingCategories: string[];

  // Demo
  isDemoMode: boolean;

  // Actions
  buyShares: (marketId: string, side: "YES" | "NO", shares: number, price: number) => void;
  sellShares: (marketId: string, side: "YES" | "NO", shares: number, price: number) => void;
  sellPosition: (marketId: string, side: "YES" | "NO", shares: number) => void;
  toggleFollow: (userId: string) => void;
  toggleSubscribe: (userId: string) => void;
  toggleLike: (postId: string) => void;
  toggleCommentLike: (commentId: string) => void;
  toggleBookmarkPost: (postId: string) => void;
  toggleSaveMarket: (marketId: string) => void;
  updateProfile: (patch: ProfileOverride) => void;
  addPost: (draft: {
    body: string;
    category?: Category;
    marketId?: string;
    images?: string[];
    boostZaps?: number;
    boostDurationH?: 1 | 4 | 24;
  }) => UserPost;
  recordImpression: (postId: string) => void;
  recordClick: (postId: string) => void;
  bumpAffinity: (
    category: string,
    signal:
      | "click"
      | "dwell_3s"
      | "dwell_10s"
      | "like"
      | "comment"
      | "follow_author",
  ) => void;
  applyThrottleCheck: (postId: string) => void;
  upsertDraft: (
    patch: Omit<LocalDraft, "updatedAt"> & { id?: string },
  ) => LocalDraft;
  deleteDraft: (id: string) => void;
  addComment: (postId: string, body: string, parentId?: string | null) => UserComment;
  setOnboarded: (v: boolean) => void;
  setOnboardingCategories: (categories: string[]) => void;
  setNotificationsOpen: (open: boolean) => void;
  markNotificationsRead: () => void;
  setDemoMode: (on: boolean) => void;
  pushLiveTrade: (trade: UserTrade) => void;
  tickPrice: (marketId: string, side: "YES" | "NO", delta: number) => void;
  reset: () => void;
}

const CURRENT_USER_ID = "u-current";

const initialMarketPrices: Record<
  string,
  { yes: number; no: number; volume: number; flash?: "up" | "down" | null }
> = {};
markets.forEach((m) => {
  initialMarketPrices[m.id] = {
    yes: m.currentYesPrice,
    no: m.currentNoPrice,
    volume: m.totalVolume,
    flash: null,
  };
});

export const useZapStore = create<ZapState>()(
  (set, get) => ({
      points: 1000,
      totalPredictions: 0,
      profileOverride: {},
      followingUserIds: [],
      subscribedUserIds: [],
      positions: [],
      likedPostIds: [],
      likedCommentIds: [],
      bookmarkedPostIds: [],
      savedMarketIds: [],
      affinity: {},
      throttleEventsAt: [],
      cooldownEndsAt: null,
      postImpressions: {},
      postClicks: {},
      userPosts: [],
      commentsByPostId: {},
      drafts: [],
      marketPrices: initialMarketPrices,
      recentTrades: recentTrades.map((t) => ({ ...t, isMine: false })),
      unreadNotifications: 2,
      notificationsOpen: false,
      onboarded: false,
      onboardingCategories: [],
      isDemoMode: false,

      buyShares: (marketId, side, shares, price) => {
        const state = get();
        const cost = Math.round((shares * price) / 100);
        if (cost > state.points) return;
        const existing = state.positions.find(
          (p) => p.marketId === marketId && p.side === side
        );
        const newPositions = existing
          ? state.positions.map((p) =>
              p === existing
                ? {
                    ...p,
                    shares: p.shares + shares,
                    avgPrice: Math.round(
                      (p.avgPrice * p.shares + price * shares) / (p.shares + shares)
                    ),
                    staked: p.staked + cost,
                  }
                : p
            )
          : [
              ...state.positions,
              {
                marketId,
                side,
                shares,
                avgPrice: price,
                staked: cost,
                openedAt: new Date().toISOString(),
              },
            ];
        const prev = state.marketPrices[marketId] ?? { yes: 50, no: 50, volume: 0, flash: null };
        const impact = Math.min(3, Math.max(0.4, shares / 600));
        let newYes = prev.yes;
        if (side === "YES") newYes = Math.min(99, prev.yes + impact);
        else newYes = Math.max(1, prev.yes - impact);
        const newTrade: UserTrade = {
          id: `t-mine-${Date.now()}`,
          marketId,
          userId: CURRENT_USER_ID,
          side,
          shares,
          price,
          timestamp: new Date().toISOString(),
          isMine: true,
        };
        set({
          points: state.points - cost,
          totalPredictions: state.totalPredictions + 1,
          positions: newPositions,
          marketPrices: {
            ...state.marketPrices,
            [marketId]: {
              yes: Math.round(newYes),
              no: 100 - Math.round(newYes),
              volume: prev.volume + cost,
              flash: side === "YES" ? "up" : "down",
            },
          },
          recentTrades: [newTrade, ...state.recentTrades].slice(0, 80),
        });
        setTimeout(() => {
          const s = get();
          set({
            marketPrices: {
              ...s.marketPrices,
              [marketId]: { ...s.marketPrices[marketId], flash: null },
            },
          });
        }, 1200);
      },

      sellShares: (marketId, side, shares, price) => {
        const state = get();
        const pos = state.positions.find(
          (p) => p.marketId === marketId && p.side === side
        );
        if (!pos) return;
        const sellShares = Math.min(shares, pos.shares);
        const proceeds = Math.round((sellShares * price) / 100);
        const newPositions = state.positions
          .map((p) =>
            p === pos
              ? {
                  ...p,
                  shares: p.shares - sellShares,
                  staked: Math.round(
                    p.staked * ((p.shares - sellShares) / p.shares)
                  ),
                }
              : p
          )
          .filter((p) => p.shares > 0);
        const prev = state.marketPrices[marketId];
        const impact = Math.min(3, Math.max(0.4, sellShares / 600));
        let newYes = prev.yes;
        if (side === "YES") newYes = Math.max(1, prev.yes - impact);
        else newYes = Math.min(99, prev.yes + impact);
        set({
          points: state.points + proceeds,
          positions: newPositions,
          marketPrices: {
            ...state.marketPrices,
            [marketId]: {
              yes: Math.round(newYes),
              no: 100 - Math.round(newYes),
              volume: prev.volume + proceeds,
              flash: side === "YES" ? "down" : "up",
            },
          },
        });
        setTimeout(() => {
          const s = get();
          set({
            marketPrices: {
              ...s.marketPrices,
              [marketId]: { ...s.marketPrices[marketId], flash: null },
            },
          });
        }, 1200);
      },

      toggleFollow: (userId) => {
        const state = get();
        const following = state.followingUserIds.includes(userId);
        set({
          followingUserIds: following
            ? state.followingUserIds.filter((id) => id !== userId)
            : [...state.followingUserIds, userId],
        });
      },

      toggleSubscribe: (userId) => {
        const state = get();
        const subscribed = state.subscribedUserIds.includes(userId);
        set({
          subscribedUserIds: subscribed
            ? state.subscribedUserIds.filter((id) => id !== userId)
            : [...state.subscribedUserIds, userId],
        });
      },

      toggleLike: (postId) => {
        const state = get();
        const wasLiked = state.likedPostIds.includes(postId);
        // Lookup category for affinity (user posts + seed posts).
        const userPost = state.userPosts.find((p) => p.id === postId);
        let category: string | undefined = userPost?.category;
        if (!category) {
          const seed = seedPosts.find((p) => p.id === postId);
          if (seed && "category" in seed && (seed as any).category) {
            category = (seed as any).category as Category;
          } else if (seed && "marketId" in seed && (seed as any).marketId) {
            const m = markets.find((mm) => mm.id === (seed as any).marketId);
            if (m) category = m.category;
          }
        }
        set({
          likedPostIds: wasLiked
            ? state.likedPostIds.filter((id) => id !== postId)
            : [...state.likedPostIds, postId],
          affinity:
            !wasLiked && category
              ? updateAffinity(state.affinity, category, "like")
              : state.affinity,
        });
      },

      toggleCommentLike: (commentId) => {
        const state = get();
        set({
          likedCommentIds: state.likedCommentIds.includes(commentId)
            ? state.likedCommentIds.filter((id) => id !== commentId)
            : [...state.likedCommentIds, commentId],
        });
      },

      toggleBookmarkPost: (postId) => {
        const state = get();
        set({
          bookmarkedPostIds: state.bookmarkedPostIds.includes(postId)
            ? state.bookmarkedPostIds.filter((id) => id !== postId)
            : [...state.bookmarkedPostIds, postId],
        });
      },

      toggleSaveMarket: (marketId) => {
        const state = get();
        set({
          savedMarketIds: state.savedMarketIds.includes(marketId)
            ? state.savedMarketIds.filter((id) => id !== marketId)
            : [...state.savedMarketIds, marketId],
        });
      },

      updateProfile: (patch) => {
        set((s) => ({ profileOverride: { ...s.profileOverride, ...patch } }));
      },

      sellPosition: (marketId, side, shares) => {
        const state = get();
        const pos = state.positions.find(
          (p) => p.marketId === marketId && p.side === side
        );
        if (!pos) return;
        const sellQty = Math.min(shares, pos.shares);
        if (sellQty <= 0) return;
        const prev = state.marketPrices[marketId];
        const price =
          side === "YES" ? prev?.yes ?? pos.avgPrice : prev?.no ?? pos.avgPrice;
        const proceeds = Math.round((sellQty * price) / 100);
        const newPositions = state.positions
          .map((p) =>
            p === pos
              ? {
                  ...p,
                  shares: p.shares - sellQty,
                  staked: Math.round(
                    p.staked * ((p.shares - sellQty) / p.shares)
                  ),
                }
              : p
          )
          .filter((p) => p.shares > 0);
        const impact = Math.min(3, Math.max(0.4, sellQty / 600));
        let newYes = prev?.yes ?? 50;
        if (side === "YES") newYes = Math.max(1, newYes - impact);
        else newYes = Math.min(99, newYes + impact);
        set({
          points: state.points + proceeds,
          positions: newPositions,
          marketPrices: {
            ...state.marketPrices,
            [marketId]: {
              yes: Math.round(newYes),
              no: 100 - Math.round(newYes),
              volume: (prev?.volume ?? 0) + proceeds,
              flash: side === "YES" ? "down" : "up",
            },
          },
        });
        setTimeout(() => {
          const s = get();
          set({
            marketPrices: {
              ...s.marketPrices,
              [marketId]: { ...s.marketPrices[marketId], flash: null },
            },
          });
        }, 1200);
      },

      addPost: (draft) => {
        const state = get();
        const boostZaps = draft.boostZaps && draft.boostZaps > 0 ? draft.boostZaps : 0;
        const boostDurationH = draft.boostDurationH ?? 4;
        const finalBoost = boostZaps > state.points ? 0 : boostZaps;
        const now = new Date();
        const boostUntil =
          finalBoost > 0
            ? new Date(now.getTime() + boostDurationH * 3_600_000).toISOString()
            : null;

        const post: UserPost = {
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "user",
          userId: CURRENT_USER_ID,
          createdAt: now.toISOString(),
          body: draft.body,
          category: draft.category,
          marketId: draft.marketId,
          images: draft.images,
          likes: 0,
          comments: 0,
          shares: 0,
          views: 1,
          isMine: true,
          boostZaps: finalBoost > 0 ? finalBoost : undefined,
          boostUntil,
          impressions: 0,
          clicks: 0,
          throttled: false,
          boostEarlyStoppedAt: null,
        };
        set((s) => ({
          userPosts: [post, ...s.userPosts],
          points: s.points - finalBoost,
        }));
        return post;
      },

      recordImpression: (postId) => {
        set((s) => {
          const isUser = s.userPosts.find((p) => p.id === postId);
          const nextUserPosts = isUser
            ? s.userPosts.map((p) =>
                p.id === postId
                  ? { ...p, impressions: (p.impressions ?? 0) + 1 }
                  : p,
              )
            : s.userPosts;
          return {
            postImpressions: {
              ...s.postImpressions,
              [postId]: (s.postImpressions[postId] ?? 0) + 1,
            },
            userPosts: nextUserPosts,
          };
        });
      },

      recordClick: (postId) => {
        set((s) => {
          const isUser = s.userPosts.find((p) => p.id === postId);
          const nextUserPosts = isUser
            ? s.userPosts.map((p) =>
                p.id === postId ? { ...p, clicks: (p.clicks ?? 0) + 1 } : p,
              )
            : s.userPosts;
          return {
            postClicks: {
              ...s.postClicks,
              [postId]: (s.postClicks[postId] ?? 0) + 1,
            },
            userPosts: nextUserPosts,
          };
        });
      },

      bumpAffinity: (category, signal) => {
        set((s) => ({
          affinity: updateAffinity(s.affinity, category, signal as AffinitySignal),
        }));
      },

      upsertDraft: (patch) => {
        const now = new Date().toISOString();
        const state = get();
        const id =
          patch.id ?? `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const next: LocalDraft = {
          id,
          bodyHtml: patch.bodyHtml,
          category: patch.category,
          marketId: patch.marketId,
          images: patch.images,
          updatedAt: now,
        };
        const without = state.drafts.filter((d) => d.id !== id);
        set({ drafts: [next, ...without].slice(0, 20) });
        return next;
      },
      deleteDraft: (id) =>
        set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),

      applyThrottleCheck: (postId) => {
        const s = get();
        const post = s.userPosts.find((p) => p.id === postId);
        if (!post || post.throttled) return;
        const verdict = checkThrottle({
          createdAt: post.createdAt,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          impressions: post.impressions ?? 0,
          boostUntil: post.boostUntil ?? null,
        });
        if (!verdict.throttled) return;
        const now = new Date().toISOString();
        const recent = [...s.throttleEventsAt, now].filter((iso) => {
          const diff = Date.now() - new Date(iso).getTime();
          return diff < 7 * 24 * 3_600_000;
        });
        const cooldown =
          recent.length >= 3
            ? new Date(Date.now() + 24 * 3_600_000).toISOString()
            : s.cooldownEndsAt;
        set({
          userPosts: s.userPosts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  throttled: true,
                  boostUntil: verdict.stopBoost ? null : p.boostUntil,
                  boostEarlyStoppedAt: verdict.stopBoost ? now : p.boostEarlyStoppedAt,
                }
              : p,
          ),
          throttleEventsAt: recent,
          cooldownEndsAt: cooldown,
        });
      },

      addComment: (postId, body, parentId = null) => {
        const comment: UserComment = {
          id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          postId,
          authorId: CURRENT_USER_ID,
          body,
          createdAt: new Date().toISOString(),
          likes: 0,
          parentId,
        };
        set((s) => {
          const list = s.commentsByPostId[postId] ?? [];
          // Also bump comment count on userPosts if applicable
          const isUserPost = s.userPosts.find((p) => p.id === postId);
          const updatedUserPosts = isUserPost
            ? s.userPosts.map((p) =>
                p.id === postId ? { ...p, comments: p.comments + 1 } : p
              )
            : s.userPosts;
          return {
            commentsByPostId: { ...s.commentsByPostId, [postId]: [...list, comment] },
            userPosts: updatedUserPosts,
          };
        });
        return comment;
      },

      setOnboarded: (v) => set({ onboarded: v }),
      setOnboardingCategories: (categories) => set({ onboardingCategories: categories }),
      setNotificationsOpen: (open) => set({ notificationsOpen: open }),
      markNotificationsRead: () => set({ unreadNotifications: 0 }),
      setDemoMode: (on) => set({ isDemoMode: on }),
      pushLiveTrade: (trade) =>
        set((s) => ({ recentTrades: [trade, ...s.recentTrades].slice(0, 80) })),
      tickPrice: (marketId, side, delta) => {
        set((s) => {
          const prev = s.marketPrices[marketId];
          if (!prev) return s;
          let newYes = prev.yes;
          if (side === "YES") newYes = Math.max(1, Math.min(99, prev.yes + delta));
          else newYes = Math.max(1, Math.min(99, prev.yes - delta));
          return {
            marketPrices: {
              ...s.marketPrices,
              [marketId]: {
                yes: Math.round(newYes),
                no: 100 - Math.round(newYes),
                volume: prev.volume + Math.abs(delta) * 1000,
                flash:
                  delta > 0
                    ? side === "YES"
                      ? "up"
                      : "down"
                    : side === "YES"
                    ? "down"
                    : "up",
              },
            },
          };
        });
        setTimeout(() => {
          set((s) => ({
            marketPrices: {
              ...s.marketPrices,
              [marketId]: { ...s.marketPrices[marketId], flash: null },
            },
          }));
        }, 1200);
      },
      reset: () =>
        set({
          points: 1000,
          totalPredictions: 0,
          profileOverride: {},
          followingUserIds: [],
          subscribedUserIds: [],
          positions: [],
          likedPostIds: [],
          likedCommentIds: [],
          bookmarkedPostIds: [],
          savedMarketIds: [],
          affinity: {},
          throttleEventsAt: [],
          cooldownEndsAt: null,
          postImpressions: {},
          postClicks: {},
          userPosts: [],
          commentsByPostId: {},
          drafts: [],
          marketPrices: initialMarketPrices,
          onboarded: false,
          onboardingCategories: [],
        }),
    }),
);

// ---------------- Hydration ----------------
//
// Phase 10: zustand `persist` middleware was removed — the store is now
// purely in-memory and resets on full page reload. The two hooks below
// stay around because lots of components still call them; they're now
// straightforward client-only flags rather than persist-tied helpers.

export function useHydrateZapStore() {
  // No-op since there's no persisted state to rehydrate any more.
}

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
