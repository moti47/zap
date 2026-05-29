"use client";

import { useEffect, useRef } from "react";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type {
  PostRow,
  CommentRow,
  TradeRow,
  MarketRow,
  NotificationRow,
} from "@/lib/supabase/types";

type Handler<T> = (payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  row: T;
  old: T | null;
}) => void;

/**
 * Stash the latest handler in a ref so the effect closure always reads
 * the most recent function without listing it as a dependency. Without
 * this, the realtime channel tears down and re-subscribes on every
 * parent render — wasted RTTs and a known Supabase channel-registry
 * race that throws on the next `.on()` call.
 */
function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * CRITICAL: every channel name MUST be suffixed with a per-mount
 * nonce. Supabase keeps a process-wide registry of channels by name.
 * React's strict-mode double-mount (and HMR / Fast Refresh) cleans
 * up the first channel asynchronously, so a second `.channel(name)`
 * with the same key during the same tick returns the already-
 * subscribed instance — and `.on(...)` after `.subscribe()` throws:
 *
 *   "cannot add postgres_changes callbacks for realtime:...:UID after
 *    subscribe()."
 *
 * Suffixing with `Date.now()` (or a per-mount counter) guarantees a
 * fresh entry every mount, and cleanup removes exactly the channel we
 * created. This mirrors the pattern in `use-viewer.ts`.
 */
function uniqueChannelName(base: string): string {
  return `${base}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/** Subscribe to live trades. Optionally scoped to a single market. */
export function useTradesChannel(handler: Handler<TradeRow>, marketId?: string) {
  const handlerRef = useLatestRef(handler);
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const sb = createClient();
    const base = marketId ? `trades:${marketId}` : "trades:all";
    const channel = sb
      .channel(uniqueChannelName(base))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          ...(marketId ? { filter: `market_id=eq.${marketId}` } : {}),
        },
        (p) =>
          handlerRef.current({
            eventType: "INSERT",
            row: p.new as TradeRow,
            old: null,
          }),
      )
      .subscribe();
    return () => {
      try {
        void sb.removeChannel(channel);
      } catch {
        // best-effort
      }
    };
  }, [marketId, handlerRef]);
}

/** Subscribe to new posts (feed-wide). */
export function usePostsChannel(handler: Handler<PostRow>) {
  const handlerRef = useLatestRef(handler);
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const sb = createClient();
    const channel = sb
      .channel(uniqueChannelName("posts:all"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        (p) =>
          handlerRef.current({
            eventType: p.eventType as "INSERT" | "UPDATE" | "DELETE",
            row: (p.new ?? p.old) as PostRow,
            old: (p.old ?? null) as PostRow | null,
          }),
      )
      .subscribe();
    return () => {
      try {
        void sb.removeChannel(channel);
      } catch {
        // best-effort
      }
    };
  }, [handlerRef]);
}

/** Subscribe to comments on a specific post. */
export function useCommentsChannel(postId: string, handler: Handler<CommentRow>) {
  const handlerRef = useLatestRef(handler);
  useEffect(() => {
    if (!postId) return;
    if (!hasSupabaseEnv()) return;
    const sb = createClient();
    const channel = sb
      .channel(uniqueChannelName(`comments:${postId}`))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        (p) =>
          handlerRef.current({
            eventType: p.eventType as "INSERT" | "UPDATE" | "DELETE",
            row: (p.new ?? p.old) as CommentRow,
            old: (p.old ?? null) as CommentRow | null,
          }),
      )
      .subscribe();
    return () => {
      try {
        void sb.removeChannel(channel);
      } catch {
        // best-effort
      }
    };
  }, [postId, handlerRef]);
}

/** Subscribe to market-price updates. */
export function useMarketsChannel(handler: Handler<MarketRow>) {
  const handlerRef = useLatestRef(handler);
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const sb = createClient();
    const channel = sb
      .channel(uniqueChannelName("markets:all"))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (p) =>
          handlerRef.current({
            eventType: "UPDATE",
            row: p.new as MarketRow,
            old: p.old as MarketRow | null,
          }),
      )
      .subscribe();
    return () => {
      try {
        void sb.removeChannel(channel);
      } catch {
        // best-effort
      }
    };
  }, [handlerRef]);
}

/** Subscribe to notifications for the current user. */
export function useNotificationsChannel(
  userId: string | null,
  handler: Handler<NotificationRow>,
) {
  const handlerRef = useLatestRef(handler);
  useEffect(() => {
    if (!userId) return;
    if (!hasSupabaseEnv()) return;
    const sb = createClient();
    const channel = sb
      .channel(uniqueChannelName(`notifications:${userId}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (p) =>
          handlerRef.current({
            eventType: "INSERT",
            row: p.new as NotificationRow,
            old: null,
          }),
      )
      .subscribe();
    return () => {
      try {
        void sb.removeChannel(channel);
      } catch {
        // best-effort
      }
    };
  }, [userId, handlerRef]);
}
