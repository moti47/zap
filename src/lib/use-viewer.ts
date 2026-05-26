"use client";

/**
 * Client-side viewer hook — the source of truth for "is there a real
 * signed-in user?" everywhere in the client tree.
 *
 *   - Fetches the current Supabase user + profile row once on mount.
 *   - Subscribes to `supabase.auth.onAuthStateChange` so SIGNED_IN /
 *     SIGNED_OUT / TOKEN_REFRESHED events flip the cached state
 *     instantly.
 *   - Subscribes to a per-row Postgres realtime channel so edits to
 *     `profiles` (avatar, banner, zaps, is_admin) propagate too. The
 *     channel name carries a Date.now() suffix and we always
 *     `removeChannel` before re-subscribing — Supabase's internal
 *     channel registry will silently return an already-subscribed
 *     channel if you reuse the same name, and then `.on()` after
 *     `.subscribe()` throws.
 *
 * NEVER fall through to a fake "Y" profile when `viewer` is null — UI
 * MUST show Sign in / Create account CTAs instead.
 */

import { useEffect, useState } from "react";
import { createClient as createBrowserClient, hasSupabaseEnv } from "./supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Viewer {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  zaps: number;
  is_admin: boolean;
  updated_at: string;
}

interface State {
  viewer: Viewer | null;
  loading: boolean;
}

async function fetchViewer(
  supabase: SupabaseClient,
): Promise<Viewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select(
      "id, username, name, avatar_url, banner_url, bio, zaps, is_admin, role, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: user.email ?? "",
    avatar_url: row.avatar_url,
    banner_url: row.banner_url,
    bio: row.bio,
    zaps: row.zaps,
    is_admin:
      Boolean(row.is_admin) ||
      (typeof row.role === "string" && row.role === "admin"),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

export function useViewer(): State {
  const [state, setState] = useState<State>({ viewer: null, loading: true });

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setState({ viewer: null, loading: false });
      return;
    }
    let cancelled = false;
    let profileChannel: ReturnType<SupabaseClient["channel"]> | null = null;
    let subscribedForId: string | null = null;
    const supabase = createBrowserClient();

    /**
     * Replace any existing channel with a fresh one for this viewer.
     * Always tears down before creating + uses a unique-per-mount
     * channel name so Supabase's internal registry can't hand us back
     * an already-subscribed instance (which crashes `.on()` calls).
     */
    const ensureChannel = (viewerId: string) => {
      if (subscribedForId === viewerId && profileChannel) return;
      // Tear down anything stale first.
      if (profileChannel) {
        try {
          supabase.removeChannel(profileChannel);
        } catch {
          // best-effort
        }
        profileChannel = null;
      }
      subscribedForId = viewerId;
      const channelName = `viewer:${viewerId}:${Date.now()}`;
      const channel = supabase.channel(channelName);
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${viewerId}`,
        },
        () => {
          if (cancelled) return;
          fetchViewer(supabase).then((next) => {
            if (!cancelled) {
              setState((prev) => ({ ...prev, viewer: next }));
            }
          });
        },
      );
      channel.subscribe();
      profileChannel = channel;
    };

    const refresh = async () => {
      try {
        const viewer = await fetchViewer(supabase);
        if (cancelled) return;
        setState({ viewer, loading: false });
        if (viewer) ensureChannel(viewer.id);
      } catch (err) {
        // Never block the rest of the app on a profile fetch failure
        // — set loading=false so gated clicks unblock.
        if (!cancelled) setState({ viewer: null, loading: false });
        // eslint-disable-next-line no-console
        console.error("[useViewer] refresh failed:", err);
      }
    };

    // Initial fetch.
    refresh();

    // CRITICAL: react to auth state changes. SIGNED_OUT must
    // immediately flip the viewer to null so the topbar swaps to
    // Sign in / Create account in the same render frame.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT" || !session) {
        if (profileChannel) {
          try {
            supabase.removeChannel(profileChannel);
          } catch {
            // best-effort
          }
          profileChannel = null;
        }
        subscribedForId = null;
        setState({ viewer: null, loading: false });
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED — re-fetch.
      refresh();
    });

    return () => {
      cancelled = true;
      try {
        subscription.unsubscribe();
      } catch {
        // best-effort
      }
      if (profileChannel) {
        try {
          supabase.removeChannel(profileChannel);
        } catch {
          // best-effort
        }
        profileChannel = null;
      }
    };
  }, []);

  return state;
}
