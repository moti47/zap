/**
 * Phase 11+ — Multi-layer interest graph.
 *
 * Replaces the flat `Record<categorySlug, number>` affinity that lived
 * inside `lib/exposure.ts`. The new graph tracks affinity along eight
 * independent dimensions so the feed can personalize on content style,
 * not just category.
 *
 *   categories          — politics / crypto / sports / …
 *   hashtags            — #ai, #fed, #playoffs
 *   authors             — strong follow-style preference
 *   sentiment_styles    — analytical / hot-take / data / meme / debate
 *   content_formats     — long_form / short / image / market_attached
 *   interaction_depth   — fast_scroll / dwell / open_comments / open_market
 *   market_behaviors    — type of market user trades (binary, prob, sports, crypto)
 *   session_patterns    — time-of-day, dwell, session length
 *
 * Every dimension stores `{ [key]: 0..1 }`. A missing key is read as the
 * neutral default (0.3). All updates are EWMA toward 1 — a single strong
 * signal can lift, but it saturates.
 */

import { clamp } from "./utils";

export type AffinityLayer =
  | "categories"
  | "hashtags"
  | "authors"
  | "sentiment_styles"
  | "content_formats"
  | "interaction_depth"
  | "market_behaviors"
  | "session_patterns";

export type AffinityScores = Record<string, number>;

export type AffinityGraph = Record<AffinityLayer, AffinityScores>;

export const EMPTY_GRAPH: AffinityGraph = {
  categories: {},
  hashtags: {},
  authors: {},
  sentiment_styles: {},
  content_formats: {},
  interaction_depth: {},
  market_behaviors: {},
  session_patterns: {},
};

export const NEUTRAL_AFFINITY = 0.3;

/**
 * Coerce any legacy shape into the full graph. Phases 6-10 stored
 * `affinity` as a flat object of `{ slug: 0..1 }`. We treat that as
 * the categories layer so old data still works.
 */
export function normalizeGraph(raw: unknown): AffinityGraph {
  const out: AffinityGraph = {
    categories: {},
    hashtags: {},
    authors: {},
    sentiment_styles: {},
    content_formats: {},
    interaction_depth: {},
    market_behaviors: {},
    session_patterns: {},
  };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  const layerKeys = Object.keys(out) as AffinityLayer[];
  let nested = false;
  for (const k of layerKeys) {
    if (obj[k] && typeof obj[k] === "object") {
      out[k] = { ...(obj[k] as AffinityScores) };
      nested = true;
    }
  }
  if (!nested) {
    // legacy flat shape: { politics: 0.7, crypto: 0.4 }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out.categories[k] = clamp(v, 0, 1);
      }
    }
  }
  return out;
}

export function readAffinity(
  graph: AffinityGraph | undefined | null,
  layer: AffinityLayer,
  key: string,
): number {
  return clamp(
    graph?.[layer]?.[key] ?? NEUTRAL_AFFINITY,
    0,
    1,
  );
}

// ---- Signal taxonomy ------------------------------------------------

/**
 * Every interaction is one of these signals. Weights are deliberately
 * tuned so passive signals nudge slowly and the strongest (trade-after-read,
 * follow, comment) shift the score in a single tick.
 */
export const SIGNAL_WEIGHTS = {
  // ---- passive ----
  dwell_3s: 0.02,
  dwell_10s: 0.05,
  dwell_30s: 0.08,
  scroll_stop: 0.03,
  expand_comments: 0.06,
  expand_image: 0.04,
  open_market: 0.10,
  open_profile: 0.07,
  hover_desktop: 0.02,

  // ---- active ----
  like: 0.08,
  comment: 0.12,
  bookmark: 0.10,
  share: 0.10,
  follow_author: 0.18,
  trade_after_read: 0.25, // strongest positive
  click_hashtag: 0.08,
  click_category: 0.06,

  // ---- negative (subtract instead of add) ----
  fast_scroll_away: -0.06,
  hide_post: -0.25,
  mute_author: -0.40,
  repeated_skip: -0.10,
} as const;

export type Signal = keyof typeof SIGNAL_WEIGHTS;

export function isNegative(sig: Signal): boolean {
  return SIGNAL_WEIGHTS[sig] < 0;
}

/**
 * Apply a single signal across the layers it affects. Returns a brand
 * new graph (immutable). Keys are extracted by the caller from the
 * post being interacted with.
 */
export interface SignalContext {
  category?: string;
  hashtags?: string[];
  authorId?: string;
  sentimentStyle?: string; // 'analytical' | 'meme' | 'hot_take' | 'data' | 'debate'
  contentFormat?: string;  // 'long_form' | 'short' | 'image' | 'market_attached'
  marketBehavior?: string; // 'binary' | 'multi' | 'crypto_market' | 'sports_market' | …
  sessionBucket?: string;  // 'late_night' | 'morning' | 'evening' | …
}

export function applySignal(
  graph: AffinityGraph,
  signal: Signal,
  ctx: SignalContext,
): AffinityGraph {
  const delta = SIGNAL_WEIGHTS[signal];
  const next: AffinityGraph = {
    categories: { ...graph.categories },
    hashtags: { ...graph.hashtags },
    authors: { ...graph.authors },
    sentiment_styles: { ...graph.sentiment_styles },
    content_formats: { ...graph.content_formats },
    interaction_depth: { ...graph.interaction_depth },
    market_behaviors: { ...graph.market_behaviors },
    session_patterns: { ...graph.session_patterns },
  };

  const bump = (layer: AffinityLayer, key: string) => {
    const prev = next[layer][key] ?? NEUTRAL_AFFINITY;
    // EWMA: signed delta toward the right endpoint (1 if positive, 0 if negative).
    const target = delta >= 0 ? 1 : 0;
    const step = Math.abs(delta);
    next[layer][key] = clamp(prev + step * (target - prev), 0, 1);
  };

  if (ctx.category) bump("categories", ctx.category);
  if (ctx.hashtags?.length) ctx.hashtags.forEach((h) => bump("hashtags", h));
  if (ctx.authorId) bump("authors", ctx.authorId);
  if (ctx.sentimentStyle) bump("sentiment_styles", ctx.sentimentStyle);
  if (ctx.contentFormat) bump("content_formats", ctx.contentFormat);
  if (ctx.marketBehavior) bump("market_behaviors", ctx.marketBehavior);
  if (ctx.sessionBucket) bump("session_patterns", ctx.sessionBucket);

  // Interaction depth is encoded by the signal itself.
  const depthKey =
    signal === "dwell_30s" || signal === "dwell_10s"
      ? "dwell"
      : signal === "expand_comments"
        ? "comments"
        : signal === "open_market"
          ? "market"
          : signal === "fast_scroll_away" || signal === "repeated_skip"
            ? "skip"
            : null;
  if (depthKey) bump("interaction_depth", depthKey);

  return next;
}

// ---- Personalization scoring ---------------------------------------

/**
 * Given a post's context and the viewer's graph, return a [0,1] match
 * score and a per-layer breakdown so the explainability layer can show
 * "Shown because: …".
 */
export interface MatchInputs {
  graph: AffinityGraph | undefined | null;
  category?: string;
  hashtags?: string[];
  authorId?: string;
  sentimentStyle?: string;
  contentFormat?: string;
  marketBehavior?: string;
  sessionBucket?: string;
}

export interface MatchBreakdown {
  score: number;
  contributions: Array<{ layer: AffinityLayer; key: string; value: number; weight: number }>;
}

const LAYER_WEIGHTS: Record<AffinityLayer, number> = {
  categories: 0.28,
  authors: 0.20,
  hashtags: 0.12,
  sentiment_styles: 0.10,
  content_formats: 0.10,
  market_behaviors: 0.08,
  interaction_depth: 0.07,
  session_patterns: 0.05,
};

export function matchScore(inputs: MatchInputs): MatchBreakdown {
  const g = inputs.graph;
  const contributions: MatchBreakdown["contributions"] = [];
  const push = (layer: AffinityLayer, key: string) => {
    const value = readAffinity(g, layer, key);
    const weight = LAYER_WEIGHTS[layer];
    contributions.push({ layer, key, value, weight });
  };
  if (inputs.category) push("categories", inputs.category);
  if (inputs.authorId) push("authors", inputs.authorId);
  for (const h of inputs.hashtags ?? []) push("hashtags", h);
  if (inputs.sentimentStyle) push("sentiment_styles", inputs.sentimentStyle);
  if (inputs.contentFormat) push("content_formats", inputs.contentFormat);
  if (inputs.marketBehavior) push("market_behaviors", inputs.marketBehavior);
  if (inputs.sessionBucket) push("session_patterns", inputs.sessionBucket);

  if (contributions.length === 0) {
    return { score: NEUTRAL_AFFINITY, contributions };
  }
  let weighted = 0;
  let totalWeight = 0;
  for (const c of contributions) {
    weighted += c.value * c.weight;
    totalWeight += c.weight;
  }
  // Normalize so absent layers don't drag the score down toward 0.
  const score = totalWeight > 0 ? weighted / totalWeight : NEUTRAL_AFFINITY;
  return { score: clamp(score, 0, 1), contributions };
}
