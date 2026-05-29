import "server-only";

/**
 * Tiny in-memory token-bucket rate limiter.
 *
 * Suitable for single-instance dev/preview deployments. For multi-instance
 * production (e.g. Vercel with multiple lambdas hot), swap the backing
 * Map for Upstash Redis or another shared store. The function shape is
 * the same, so call sites don't change.
 */

type Bucket = { tokens: number; refilledAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitOpts {
  /** Bucket capacity (max burst). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Suggested seconds to wait before retrying when ok=false. */
  retryAfterSec: number;
}

export function rateLimit(key: string, opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  const prev = buckets.get(key);
  const cap = Math.max(1, opts.capacity);
  const rate = Math.max(0.0001, opts.refillPerSec);

  let tokens: number;
  if (prev) {
    const elapsedSec = (now - prev.refilledAt) / 1000;
    tokens = Math.min(cap, prev.tokens + elapsedSec * rate);
  } else {
    tokens = cap;
  }

  if (tokens < 1) {
    buckets.set(key, { tokens, refilledAt: now });
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((1 - tokens) / rate),
    };
  }

  tokens -= 1;
  buckets.set(key, { tokens, refilledAt: now });
  return { ok: true, remaining: Math.floor(tokens), retryAfterSec: 0 };
}

// Lightweight periodic cleanup of cold buckets so the Map doesn't grow
// unbounded over a long-lived server process.
const STALE_AFTER_MS = 60 * 60 * 1000;
let lastSweep = Date.now();
export function sweepIfStale(): void {
  const now = Date.now();
  if (now - lastSweep < STALE_AFTER_MS) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (now - b.refilledAt > STALE_AFTER_MS) buckets.delete(k);
  }
}
