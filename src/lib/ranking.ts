/**
 * Phase 11+ — Hyper-personalized feed ranking.
 *
 * The old `exposure_score` is the *publisher-side* score: how well this
 * post should perform globally. The new `personalized_score` blends that
 * with the viewer's multi-layer affinity graph. The final feed slot is
 * 92% personalized + 8% explore, with explore picked from adjacent
 * (not random) interests.
 *
 *   final_score =
 *     0.62 × personalized_match   // viewer's affinity graph
 *   + 0.18 × expert_factor         // author's expertise tier in category
 *   + 0.10 × engagement_factor     // global engagement / impressions
 *   + 0.07 × freshness_factor      // 12h half-life
 *   + 0.03 × boost_factor          // boost still counts, but capped
 *   − cooldown_penalty             // throttled / cooled-down authors
 *
 * After ranking by `final_score`, we replace 8% of the slots with the
 * top-N explore candidates. Slots 5, 13, 21, … get explore picks so the
 * mix feels woven, not blocked at the bottom.
 */

import { clamp } from "./utils";
import {
  matchScore,
  type AffinityGraph,
  type MatchBreakdown,
} from "./affinity";
import {
  freshnessFactor,
  engagementFactor,
  boostFactor,
} from "./exposure";

export interface RankablePost {
  id: string;
  createdAt: string;
  authorId: string;
  category?: string;
  hashtags?: string[];
  sentimentStyle?: string;
  contentFormat?: string;
  marketBehavior?: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  expertPercentile: number; // 0..1
  boostZaps?: number;
  boostUntil?: string | null;
  authorCooldown?: boolean;
  throttled?: boolean;
}

export interface PersonalizedBreakdown {
  postId: string;
  finalScore: number;
  personalizedMatch: number;
  expertFactor: number;
  engagementFactor: number;
  freshnessFactor: number;
  boostFactor: number;
  cooldownPenalty: number;
  throttled: boolean;
  /** Top-3 strongest match contributions for the "Why am I seeing this?" panel. */
  topReasons: MatchBreakdown["contributions"];
}

export interface SessionState {
  /** Per-category boost from this session's interactions, decays each tick. */
  categoryBoost: Record<string, number>;
  /** When the session boost was last refreshed. */
  refreshedAt: number;
}

export const EMPTY_SESSION: SessionState = {
  categoryBoost: {},
  refreshedAt: Date.now(),
};

const SESSION_DECAY_HALF_LIFE_MS = 30 * 60 * 1000; // 30 min

export function decaySessionBoost(state: SessionState, now = Date.now()): SessionState {
  const elapsed = now - state.refreshedAt;
  if (elapsed <= 0) return state;
  const factor = Math.exp(-elapsed / SESSION_DECAY_HALF_LIFE_MS);
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.categoryBoost)) {
    const decayed = v * factor;
    if (decayed > 0.01) next[k] = decayed;
  }
  return { categoryBoost: next, refreshedAt: now };
}

export function bumpSessionCategory(
  state: SessionState,
  category: string,
  step = 0.08,
): SessionState {
  const decayed = decaySessionBoost(state);
  const prev = decayed.categoryBoost[category] ?? 0;
  return {
    categoryBoost: {
      ...decayed.categoryBoost,
      [category]: clamp(prev + step, 0, 1),
    },
    refreshedAt: decayed.refreshedAt,
  };
}

export function scorePost(
  post: RankablePost,
  graph: AffinityGraph | undefined | null,
  session: SessionState,
  now = Date.now(),
): PersonalizedBreakdown {
  const match = matchScore({
    graph,
    category: post.category,
    hashtags: post.hashtags,
    authorId: post.authorId,
    sentimentStyle: post.sentimentStyle,
    contentFormat: post.contentFormat,
    marketBehavior: post.marketBehavior,
  });

  // Apply session boost (additive lift, capped).
  const sessionLift = post.category
    ? (session.categoryBoost[post.category] ?? 0) * 0.5
    : 0;
  const personalizedMatch = clamp(match.score + sessionLift, 0, 1);

  const expert = clamp(post.expertPercentile, 0, 1);
  const eng = engagementFactor(post.likes, post.comments, post.shares, post.impressions);
  const fresh = freshnessFactor(post.createdAt, now);
  const boost = boostFactor(post.boostZaps, post.boostUntil, post.createdAt, now);

  const cooldownPenalty = post.authorCooldown ? 0.25 : 0;

  let raw =
    0.62 * personalizedMatch +
    0.18 * expert +
    0.10 * eng +
    0.07 * fresh +
    0.03 * boost -
    cooldownPenalty;

  if (post.throttled) raw = Math.min(raw, 0.5 * raw);

  const topReasons = [...match.contributions]
    .sort((a, b) => b.value * b.weight - a.value * a.weight)
    .slice(0, 3);

  return {
    postId: post.id,
    finalScore: clamp(raw, 0, 1),
    personalizedMatch,
    expertFactor: expert,
    engagementFactor: eng,
    freshnessFactor: fresh,
    boostFactor: boost,
    cooldownPenalty,
    throttled: !!post.throttled,
    topReasons,
  };
}

// ---- 92/8 mix ------------------------------------------------------

/**
 * Compose a feed slot list from two pools. The personalized pool is the
 * top-scored posts, the explore pool is high-quality posts the viewer
 * has weak (but non-zero) affinity for — adjacent interests, not random.
 *
 *   slotIndex % 12 === 5  → explore slot (≈ 8.3% of feed)
 *
 * Explore picks come from the candidate list filtered to:
 *   - personalized_match between 0.20 and 0.55
 *   - expertPercentile ≥ 0.65 (high-expertise creators)
 *
 * If the explore pool is empty for a slot, we keep the personalized pick.
 */
export interface MixOptions {
  exploreRatio?: number;
  /** Min match score required for explore eligibility (avoid pure random). */
  minMatch?: number;
  /** Min expert percentile required for explore. */
  minExpert?: number;
  /** Max match score for explore (above this, it's already in personalized). */
  maxMatch?: number;
}

export interface MixResult<T> {
  ordered: T[];
  exploreIds: Set<string>;
}

export function mix92x8<T extends { id: string }>(
  scored: Array<{ post: T; breakdown: PersonalizedBreakdown }>,
  opts: MixOptions = {},
): MixResult<T> {
  const minMatch = opts.minMatch ?? 0.2;
  const maxMatch = opts.maxMatch ?? 0.55;
  const minExpert = opts.minExpert ?? 0.65;

  // Sort by final score descending.
  const sorted = [...scored].sort(
    (a, b) => b.breakdown.finalScore - a.breakdown.finalScore,
  );

  const personalized = sorted.filter(
    (s) => s.breakdown.personalizedMatch >= maxMatch,
  );
  const explorePool = sorted
    .filter(
      (s) =>
        s.breakdown.personalizedMatch >= minMatch &&
        s.breakdown.personalizedMatch < maxMatch &&
        s.breakdown.expertFactor >= minExpert,
    )
    .sort((a, b) => b.breakdown.expertFactor - a.breakdown.expertFactor);

  // Posts that aren't in either pool drop to the bottom in score order
  // (mid-affinity, mid-expertise — still part of the feed but un-weighted).
  const fallback = sorted.filter(
    (s) =>
      !personalized.includes(s) &&
      !explorePool.includes(s),
  );

  const ordered: T[] = [];
  const exploreIds = new Set<string>();
  const personalIter = personalized[Symbol.iterator]();
  const fallbackIter = fallback[Symbol.iterator]();
  const exploreIter = explorePool[Symbol.iterator]();

  const next = (it: Iterator<{ post: T; breakdown: PersonalizedBreakdown }>): T | null => {
    const n = it.next();
    return n.done ? null : n.value.post;
  };

  const target = sorted.length;
  for (let i = 0; i < target; i++) {
    if (i > 0 && i % 12 === 5) {
      const ex = next(exploreIter);
      if (ex) {
        ordered.push(ex);
        exploreIds.add(ex.id);
        continue;
      }
    }
    const p = next(personalIter) ?? next(fallbackIter) ?? next(exploreIter);
    if (p) ordered.push(p);
  }

  return { ordered, exploreIds };
}

// ---- Stable snapshot ranking ---------------------------------------

/**
 * A snapshot freezes the order of a feed batch at the moment it was
 * fetched, plus the rank_snapshot_score that was used. Re-renders driven
 * by like/comment updates MUST NOT recompute order — they only update
 * the counts in-place. The order changes only when the user explicitly
 * refreshes (taps the "X new posts" pill).
 */
export interface FeedSnapshot<T extends { id: string }> {
  fetchedAt: number;
  /** Frozen ordered list. */
  items: T[];
  /** id → rank score at snapshot time (for debugging / explainability). */
  scores: Record<string, number>;
  /** id → explainability breakdown (lazy / partial is fine). */
  breakdowns: Record<string, PersonalizedBreakdown>;
}

export function makeSnapshot<T extends { id: string }>(
  scored: Array<{ post: T; breakdown: PersonalizedBreakdown }>,
  opts: MixOptions = {},
): FeedSnapshot<T> {
  const mixed = mix92x8(scored, opts);
  const scores: Record<string, number> = {};
  const breakdowns: Record<string, PersonalizedBreakdown> = {};
  for (const { post, breakdown } of scored) {
    scores[post.id] = breakdown.finalScore;
    breakdowns[post.id] = breakdown;
  }
  return {
    fetchedAt: Date.now(),
    items: mixed.ordered,
    scores,
    breakdowns,
  };
}

// ---- Session bucket -------------------------------------------------

/** Coarse time-of-day bucket used as a session_patterns key. */
export function sessionBucket(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "late_night";
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}
