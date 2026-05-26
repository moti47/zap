"use client";

/**
 * Client-side viewer hook — the source of truth for "is there a real
 * signed-in user?" everywhere in the client tree.
 *
 *   - Fetches the current Supabase user + profile row once on mount.
 *   - Subscribes to `supabase.auth.onAuthStateChange` so SIGNED_IN /
 *     SIGNED_OUT / TOKEN_REFRESHED events flip the cached state
 *     instantly. This is what kills the ghost-session bug: any tab
 *     that detects sign-out goes anonymous within the same React
 *     render cycle — no full page reload required.
 *   - Subscribes to a per-row Postgres realtime channel so edits to
 *     `profiles` (avatar, banner, zaps, is_admin) propagate too.
 *   - When Supabase env isn't configured (prototype/demo mode) the
 *     hook resolves to `{ viewer: null, loading: false }`.
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
    const supabase = createBrowserClient();

    const refresh = async () => {
      const viewer = await fetchViewer(supabase);
      if (cancelled) return;
      setState({ viewer, loading: false });

      // Subscribe to the viewer's profile row for live edits.
      if (viewer && !profileChannel) {
        profileChannel = supabase
          .channel(`viewer:${viewer.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${viewer.id}`,
            },
            () => {
              fetchViewer(supabase).then((next) => {
                if (!cancelled) {
                  setState((prev) => ({ ...prev, viewer: next }));
                }
              });
            },
          )
          .subscribe();
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
        // Tear down any live channel and go anonymous.
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
          profileChannel = null;
        }
        setState({ viewer: null, loading: false });
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED — re-fetch.
      refresh();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
        profileChannel = null;
      }
    };
  }, []);

  return state;
}
