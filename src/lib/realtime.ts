"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  PostRow,
  CommentRow,
  TradeRow,
  MarketRow,
  NotificationRow,
} from "@/lib/supabase/types";

type Handler<T> = (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; row: T; old: T | null }) => void;

/** Subscribe to live trades. Optionally scoped to a single market. */
export function useTradesChannel(handler: Handler<TradeRow>, marketId?: string) {
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(marketId ? `trades:${marketId}` : "trades:all")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          ...(marketId ? { filter: `market_id=eq.${marketId}` } : {}),
        },
        (p) =>
          handler({
            eventType: "INSERT",
            row: p.new as TradeRow,
            old: null,
          }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [marketId, handler]);
}

/** Subscribe to new posts (feed-wide). */
export function usePostsChannel(handler: Handler<PostRow>) {
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("posts:all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        (p) =>
          handler({
            eventType: p.eventType as "INSERT" | "UPDATE" | "DELETE",
            row: (p.new ?? p.old) as PostRow,
            old: (p.old ?? null) as PostRow | null,
          }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [handler]);
}

/** Subscribe to comments on a specific post. */
export function useCommentsChannel(postId: string, handler: Handler<CommentRow>) {
  useEffect(() => {
    if (!postId) return;
    const sb = createClient();
    const channel = sb
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        (p) =>
          handler({
            eventType: p.eventType as "INSERT" | "UPDATE" | "DELETE",
            row: (p.new ?? p.old) as CommentRow,
            old: (p.old ?? null) as CommentRow | null,
          }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [postId, handler]);
}

/** Subscribe to market-price updates. */
export function useMarketsChannel(handler: Handler<MarketRow>) {
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("markets:all")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (p) =>
          handler({
            eventType: "UPDATE",
            row: p.new as MarketRow,
            old: p.old as MarketRow | null,
          }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [handler]);
}

/** Subscribe to notifications for the current user. */
export function useNotificationsChannel(
  userId: string | null,
  handler: Handler<NotificationRow>,
) {
  useEffect(() => {
    if (!userId) return;
    const sb = createClient();
    const channel = sb
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (p) =>
          handler({
            eventType: "INSERT",
            row: p.new as NotificationRow,
            old: null,
          }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [userId, handler]);
}
