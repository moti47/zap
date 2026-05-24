/**
 * Phase 6 — Smart exposure algorithm.
 *
 * Single source of truth for the ranking math. The Postgres function
 * `public.compute_exposure_score` mirrors this exactly. The client-side
 * implementation runs on the Zustand/mock feed so the prototype demo
 * behaves identically to a real Supabase-backed feed.
 *
 *   exposure =
 *     0.40 × expert_factor
 *   + 0.25 × engagement_factor
 *   + 0.15 × freshness_factor
 *   + 0.10 × category_affinity
 *   + 0.10 × boost_factor
 *   − cooldown_penalty (0.3 if author is in cooldown)
 *
 * All factors are normalized to [0,1].
 */

import { clamp } from "./utils";

export interface ExposureInputs {
  // expert factor — percentile of author in this category, 0..1
  expertScore: number;
  // engagement factor — likes/comments/shares vs impressions, 0..1
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  // freshness — created at (ISO)
  createdAt: string;
  // affinity — viewer's [0..1] interest in this category
  categoryAffinity: number;
  // boost — { zaps, until, postCreatedAt } or null
  boostZaps?: number;
  boostUntil?: string | null;
  // anti-throttle state
  throttled?: boolean;
  cooldownActive?: boolean;
}

export interface ExposureBreakdown {
  score: number;
  expertFactor: number;
  engagementFactor: number;
  freshnessFactor: number;
  affinityFactor: number;
  boostFactor: number;
  throttled: boolean;
  cooldownActive: boolean;
}

const HALF_LIFE_HOURS = 12;

export function freshnessFactor(createdAt: string, now = Date.now()): number {
  const ageMs = now - new Date(createdAt).getTime();
  const ageHours = ageMs / 3_600_000;
  // exp decay; 12h half-life means f(0)=1, f(12)≈0.37, f(36)≈0.05
  return clamp(Math.exp(-ageHours / HALF_LIFE_HOURS), 0, 1);
}

export function engagementFactor(
  likes: number,
  comments: number,
  shares: number,
  impressions: number,
): number {
  const weighted = likes * 1.0 + comments * 2.0 + shares * 3.0;
  // Bootstrap: < 5 impressions, normalize against a fixed 50.
  if (impressions < 5) return clamp(weighted / 50, 0, 1);
  // 4× lift to scale per-impression engagement (~25% raw = full).
  return clamp((weighted / Math.max(impressions, 1)) * 4, 0, 1);
}

export function boostFactor(
  zaps: number | undefined,
  until: string | null | undefined,
  createdAt: string,
  now = Date.now(),
): number {
  if (!zaps || !until) return 0;
  const endMs = new Date(until).getTime();
  if (endMs <= now) return 0;
  const startMs = new Date(createdAt).getTime();
  const total = endMs - startMs;
  const remaining = endMs - now;
  if (total <= 0) return 0;
  // amplitude: log-scaled 50→0.25, 200→0.5, 500→0.75, 1500→1
  const amplitude = clamp(Math.log(Math.max(zaps, 1)) / Math.log(1500), 0, 1);
  const decay = clamp(remaining / total, 0, 1);
  return clamp(amplitude * decay, 0, 1);
}

export function computeExposure(inputs: ExposureInputs): ExposureBreakdown {
  const expertFactor = clamp(inputs.expertScore, 0, 1);
  const engFactor = engagementFactor(
    inputs.likes,
    inputs.comments,
    inputs.shares,
    inputs.impressions,
  );
  const freshness = freshnessFactor(inputs.createdAt);
  const affinity = clamp(inputs.categoryAffinity, 0, 1);
  const boost = boostFactor(
    inputs.boostZaps,
    inputs.boostUntil,
    inputs.createdAt,
  );

  const cooldownPenalty = inputs.cooldownActive ? 0.3 : 0;
  let raw =
    0.4 * expertFactor +
    0.25 * engFactor +
    0.15 * freshness +
    0.1 * affinity +
    0.1 * boost -
    cooldownPenalty;

  if (inputs.throttled) {
    // halved, AND boost amplification is suppressed (already mixed in).
    raw = Math.min(raw, 0.5 * raw);
  }

  return {
    score: clamp(raw, 0, 1),
    expertFactor,
    engagementFactor: engFactor,
    freshnessFactor: freshness,
    affinityFactor: affinity,
    boostFactor: boost,
    throttled: !!inputs.throttled,
    cooldownActive: !!inputs.cooldownActive,
  };
}

/**
 * Apply the anti-spam rules in-memory and return whether the post was
 * just throttled. Mirrors `public.check_throttle`.
 *
 *   A) age ≥ 2h, no boost, engagement < 0.10  → throttle
 *   B) age ≥ 1h, boost active, engagement < 0.15 → throttle + early-stop boost
 */
export interface ThrottleInputs {
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  boostUntil?: string | null;
}

export interface ThrottleVerdict {
  throttled: boolean;
  reason: "low_engagement_2h" | "low_engagement_boost_1h" | null;
  stopBoost: boolean;
}

export function checkThrottle(
  inputs: ThrottleInputs,
  now = Date.now(),
): ThrottleVerdict {
  const ageH = (now - new Date(inputs.createdAt).getTime()) / 3_600_000;
  const eng = engagementFactor(
    inputs.likes,
    inputs.comments,
    inputs.shares,
    inputs.impressions,
  );
  const boostActive =
    !!inputs.boostUntil && new Date(inputs.boostUntil).getTime() > now;

  if (boostActive && ageH >= 1 && eng < 0.15) {
    return { throttled: true, reason: "low_engagement_boost_1h", stopBoost: true };
  }
  if (!boostActive && ageH >= 2 && eng < 0.10) {
    return { throttled: true, reason: "low_engagement_2h", stopBoost: false };
  }
  return { throttled: false, reason: null, stopBoost: false };
}

// ---- Affinity vector helpers --------------------------------------

export type AffinityVector = Record<string, number>;

export const AFFINITY_SIGNAL_WEIGHTS = {
  click: 0.04,
  dwell_3s: 0.02,
  dwell_10s: 0.06,
  like: 0.08,
  comment: 0.10,
  follow_author: 0.15,
} as const;

export type AffinitySignal = keyof typeof AFFINITY_SIGNAL_WEIGHTS;

export function updateAffinity(
  current: AffinityVector,
  categorySlug: string,
  signal: AffinitySignal,
): AffinityVector {
  const delta = AFFINITY_SIGNAL_WEIGHTS[signal];
  const prev = current[categorySlug] ?? 0.3;
  // EWMA toward 1: a single strong signal can lift, but it saturates.
  const next = clamp(prev + delta * (1 - prev), 0, 1);
  return { ...current, [categorySlug]: next };
}

// ---- Boost amount + duration presets ------------------------------

export const BOOST_AMOUNTS = [50, 200, 500, 1500] as const;
export const BOOST_DURATIONS_H = [1, 4, 24] as const;
export type BoostAmount = (typeof BOOST_AMOUNTS)[number];
export type BoostDurationH = (typeof BOOST_DURATIONS_H)[number];
