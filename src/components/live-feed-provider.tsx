"use client";

/**
 * Phase 10 — `fake-socket.ts` was deleted; live-feed updates flow through
 * `lib/realtime.ts` (Supabase channels) on the surfaces that need them.
 * This component is kept as a no-op so existing layouts that mount it
 * still compile, but it's effectively dead code that the cleanup pass
 * left in place to avoid touching every layout.
 */
export function LiveFeedProvider() {
  return null;
}
