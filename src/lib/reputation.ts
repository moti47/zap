/**
 * Phase 11+ — 10-metric reputation system.
 *
 * Expertise is *category-specific*. A user can be Elite in Crypto and
 * Skilled in Politics. The composite score is a weighted blend of ten
 * sub-metrics, each in [0, 1]:
 *
 *   1.  accuracy            — stake-weighted hit rate
 *   2.  calibration         — how close P(YES) matches reality
 *   3.  conviction_quality  — confidently-right > weakly-right
 *   4.  early_edge          — entering before consensus moves
 *   5.  consensus_outperf   — beating closing odds
 *   6.  difficulty          — being right on tough markets > easy ones
 *   7.  consistency         — low variance over a long window
 *   8.  risk_discipline     — avoids reckless all-ins
 *   9.  market_impact       — moves the market AND is later correct
 *   10. trust               — anti-spam / anti-farming quality
 */

import { clamp } from "./utils";

export interface ReputationMetrics {
  accuracy: number;
  calibration: number;
  conviction_quality: number;
  early_edge: number;
  consensus_outperf: number;
  difficulty: number;
  consistency: number;
  risk_discipline: number;
  market_impact: number;
  trust: number;
}

export const METRIC_KEYS: Array<keyof ReputationMetrics> = [
  "accuracy",
  "calibration",
  "conviction_quality",
  "early_edge",
  "consensus_outperf",
  "difficulty",
  "consistency",
  "risk_discipline",
  "market_impact",
  "trust",
];

export const METRIC_WEIGHTS: ReputationMetrics = {
  accuracy: 0.18,
  calibration: 0.16,
  conviction_quality: 0.10,
  early_edge: 0.10,
  consensus_outperf: 0.12,
  difficulty: 0.08,
  consistency: 0.08,
  risk_discipline: 0.06,
  market_impact: 0.06,
  trust: 0.06,
};

export const METRIC_LABELS: Record<keyof ReputationMetrics, string> = {
  accuracy: "Accuracy",
  calibration: "Calibration",
  conviction_quality: "Conviction",
  early_edge: "Early Edge",
  consensus_outperf: "Beat Consensus",
  difficulty: "Difficulty",
  consistency: "Consistency",
  risk_discipline: "Risk Discipline",
  market_impact: "Market Impact",
  trust: "Trust",
};

export const EMPTY_METRICS: ReputationMetrics = {
  accuracy: 0.5,
  calibration: 0.5,
  conviction_quality: 0.5,
  early_edge: 0.5,
  consensus_outperf: 0.5,
  difficulty: 0.5,
  consistency: 0.5,
  risk_discipline: 0.5,
  market_impact: 0.5,
  trust: 0.5,
};

export function composite(metrics: ReputationMetrics): number {
  let s = 0;
  for (const k of METRIC_KEYS) {
    s += clamp(metrics[k], 0, 1) * METRIC_WEIGHTS[k];
  }
  return clamp(s, 0, 1);
}

// ---- Tiers ---------------------------------------------------------

export type Tier =
  | "new"
  | "emerging"
  | "skilled"
  | "expert"
  | "elite"
  | "oracle";

export interface TierDef {
  key: Tier;
  label: string;
  minComposite: number;
  /** Minimum resolved-trade volume in this category to qualify. */
  minVolume: number;
  color: string;
  glow: string;
  /** Multiplicative boost to feed exposure for posts in this category. */
  exposureBoost: number;
  /** Diminishing-returns cap on slow decay. */
  slowDecayCap: number;
}

export const TIERS: TierDef[] = [
  { key: "new",      label: "New",      minComposite: 0.0,  minVolume: 0,    color: "#5A6175", glow: "transparent",                exposureBoost: 1.0,  slowDecayCap: 0 },
  { key: "emerging", label: "Emerging", minComposite: 0.55, minVolume: 10,   color: "#36D399", glow: "rgba(54, 211, 153, 0.25)",   exposureBoost: 1.08, slowDecayCap: 0.05 },
  { key: "skilled",  label: "Skilled",  minComposite: 0.65, minVolume: 50,   color: "#4DA3FF", glow: "rgba(77, 163, 255, 0.30)",   exposureBoost: 1.15, slowDecayCap: 0.10 },
  { key: "expert",   label: "Expert",   minComposite: 0.75, minVolume: 150,  color: "#A855F7", glow: "rgba(168, 85, 247, 0.35)",   exposureBoost: 1.22, slowDecayCap: 0.15 },
  { key: "elite",    label: "Elite",    minComposite: 0.85, minVolume: 400,  color: "#FFE600", glow: "rgba(255, 230, 0, 0.40)",    exposureBoost: 1.30, slowDecayCap: 0.20 },
  { key: "oracle",   label: "Oracle",   minComposite: 0.92, minVolume: 1000, color: "#FF2D55", glow: "rgba(255, 45, 85, 0.45)",    exposureBoost: 1.40, slowDecayCap: 0.25 },
];

export interface ResolutionStats {
  resolved: number;
  volume: number;
}

export function tierFor(
  metrics: ReputationMetrics,
  stats: ResolutionStats,
): TierDef {
  const c = composite(metrics);
  let found = TIERS[0];
  for (const t of TIERS) {
    if (c >= t.minComposite && stats.volume >= t.minVolume) found = t;
  }
  return found;
}

// ---- Diminishing-returns boost --------------------------------------

/**
 * Posts from high-expertise authors get a feed lift, but we cap the
 * total contribution per author per day so mega-creators can't
 * dominate the entire feed.
 *
 *   effective = base × tier.exposureBoost × dampener(authorPostsToday)
 */
export function dampenedBoost(
  tier: TierDef,
  authorPostsTodayInFeed: number,
): number {
  const damp = 1 / (1 + 0.4 * Math.max(0, authorPostsTodayInFeed - 1));
  return 1 + (tier.exposureBoost - 1) * damp;
}
