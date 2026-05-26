/**
 * Phase 11+ — Streak system with recovery.
 *
 *   - Track consecutive login days. Weekly + monthly streaks derived.
 *   - Miss ONE day → user has ONE recovery they can spend to restore.
 *   - Once recovery is spent, missing another day resets streak to 0.
 *   - Rebuilding a long streak later restores ONE future recovery use.
 *
 * Milestone tiers unlock visual upgrades + boost discounts.
 */

import { todayKey } from "./quests";

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  /** Number of recoveries available to spend (0 or 1). */
  recoveriesAvailable: number;
  /** Days at which a recovery was earned by rebuilding (for analytics). */
  recoveryHistory: string[];
  /** When the user "spent" a recovery to keep the streak alive. */
  pendingRecoveryFor: string | null; // YYYY-MM-DD of the missed day
}

export const FRESH_STREAK: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDay: null,
  recoveriesAvailable: 1,
  recoveryHistory: [],
  pendingRecoveryFor: null,
};

export type StreakTier = {
  min: number;
  label: string;
  color: string;
  emoji: string;
  boostDiscountPct: number;
  unlocksCosmetic: string | null;
};

export const STREAK_TIERS: StreakTier[] = [
  { min: 0,   label: "Spark",   color: "#5A6175", emoji: "✨", boostDiscountPct: 0,  unlocksCosmetic: null },
  { min: 3,   label: "Kindle",  color: "#FFB800", emoji: "🔥", boostDiscountPct: 0,  unlocksCosmetic: null },
  { min: 7,   label: "Glow",    color: "#FF8800", emoji: "🔥", boostDiscountPct: 5,  unlocksCosmetic: "flame-1" },
  { min: 14,  label: "Blaze",   color: "#FF4757", emoji: "🔥", boostDiscountPct: 8,  unlocksCosmetic: "flame-2" },
  { min: 30,  label: "Inferno", color: "#FF2D55", emoji: "🔥", boostDiscountPct: 12, unlocksCosmetic: "flame-3" },
  { min: 60,  label: "Phoenix", color: "#A855F7", emoji: "🦅", boostDiscountPct: 15, unlocksCosmetic: "phoenix" },
  { min: 100, label: "Eternal", color: "#FFE600", emoji: "⚡", boostDiscountPct: 20, unlocksCosmetic: "eternal" },
];

export function tierForStreak(streak: number): StreakTier {
  let found = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) {
    if (streak >= t.min) found = t;
  }
  return found;
}

export function nextTier(streak: number): StreakTier | null {
  for (const t of STREAK_TIERS) {
    if (t.min > streak) return t;
  }
  return null;
}

// ---- Day arithmetic ------------------------------------------------

function daysBetween(a: string, b: string): number {
  const ta = new Date(a + "T00:00:00").getTime();
  const tb = new Date(b + "T00:00:00").getTime();
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Touch the streak for a successful daily activity. Returns the next
 * state plus a `delta` describing what happened: extended, recovered,
 * reset, or already_active.
 */
export interface StreakTickResult {
  next: StreakState;
  delta: "extended" | "recovered" | "reset" | "already_active" | "started";
  reward: number;
  /** True if the user just rebuilt past a milestone (animate it). */
  milestoneHit: number | null;
}

export const RECOVERY_REBUILD_MIN = 7;

export function tickStreak(
  state: StreakState,
  today = todayKey(),
): StreakTickResult {
  const last = state.lastActiveDay;
  if (last === today) {
    return { next: state, delta: "already_active", reward: 0, milestoneHit: null };
  }

  if (!last) {
    const next = {
      ...state,
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastActiveDay: today,
    };
    return { next, delta: "started", reward: 10, milestoneHit: null };
  }

  const gap = daysBetween(last, today);

  if (gap === 1) {
    const newStreak = state.currentStreak + 1;
    const milestone = STREAK_TIERS.find(
      (t) => t.min === newStreak && t.min > 0,
    );
    // Rebuild recovery once user crosses 7 days again.
    const earnedRecovery =
      newStreak >= RECOVERY_REBUILD_MIN &&
      state.recoveriesAvailable === 0 &&
      !state.recoveryHistory.includes(today);
    return {
      next: {
        ...state,
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak, newStreak),
        lastActiveDay: today,
        recoveriesAvailable: earnedRecovery ? 1 : state.recoveriesAvailable,
        recoveryHistory: earnedRecovery
          ? [...state.recoveryHistory, today]
          : state.recoveryHistory,
        pendingRecoveryFor: null,
      },
      delta: "extended",
      reward: rewardForStreak(newStreak),
      milestoneHit: milestone ? milestone.min : null,
    };
  }

  if (gap === 2 && state.recoveriesAvailable > 0) {
    // The user missed ONE day. Auto-mark a pending recovery slot — the
    // UI will prompt the user to spend the recovery (or let the streak
    // reset). We don't auto-spend it here; that's `applyRecovery`.
    return {
      next: { ...state, pendingRecoveryFor: priorDay(today) },
      delta: "reset",
      reward: 0,
      milestoneHit: null,
    };
  }

  return {
    next: {
      ...state,
      currentStreak: 1,
      lastActiveDay: today,
      pendingRecoveryFor: null,
    },
    delta: "reset",
    reward: 5,
    milestoneHit: null,
  };
}

/** Spend the recovery to keep the streak alive. */
export function applyRecovery(
  state: StreakState,
  today = todayKey(),
): StreakState {
  if (state.recoveriesAvailable <= 0 || !state.pendingRecoveryFor) return state;
  const newStreak = state.currentStreak + 1;
  return {
    ...state,
    currentStreak: newStreak,
    longestStreak: Math.max(state.longestStreak, newStreak),
    lastActiveDay: today,
    recoveriesAvailable: 0,
    pendingRecoveryFor: null,
  };
}

function priorDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

/**
 * Reward curve (section 25 of the production spec): scales aggressively
 * with streak length to make daily login feel rewarding.
 *
 *   Day 1   → +10
 *   Day 3   → +20
 *   Day 7   → +40
 *   Day 14  → +75
 *   Day 30  → +150
 *   Day 60  → +250
 *   Day 100 → +400
 *
 * Plus milestone bonuses (`milestoneBonus()`) on top at 3/7/14/30/60/100.
 */
function rewardForStreak(streak: number): number {
  if (streak >= 100) return 400;
  if (streak >= 60) return 250;
  if (streak >= 30) return 150;
  if (streak >= 14) return 75;
  if (streak >= 7) return 40;
  if (streak >= 3) return 20;
  return 10;
}

/**
 * What the user would earn for showing up TOMORROW given their current
 * streak. Used in the motivational "Show up tomorrow for +X⚡" line.
 * Includes the milestone bonus if tomorrow lands on a milestone.
 */
export function rewardForNextDay(currentStreak: number): number {
  const nextDay = currentStreak + 1;
  return rewardForStreak(nextDay) + milestoneBonus(nextDay);
}

export function milestoneBonus(streakDay: number): number {
  switch (streakDay) {
    case 3: return 25;
    case 7: return 75;
    case 14: return 150;
    case 30: return 300;
    case 60: return 600;
    case 100: return 1500;
    default: return 0;
  }
}

// cache-bust marker for Turbopack module graph
export const STREAK_MODULE_VERSION = 2;
