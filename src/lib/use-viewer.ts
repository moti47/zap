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

/**
 * Round-3 Item #4 — Cross-component optimistic balance bus.
 *
 * Every `useViewer()` consumer holds its own local state, so a trade
 * landing in TradePanel didn't visually flow into the Topbar's
 * BalancePill until the Supabase realtime UPDATE round-tripped. We
 * publish a synchronous bump through this module-scoped emitter so
 * every mounted useViewer hook applies the delta in the same tick.
 * The authoritative Postgres UPDATE that follows simply overwrites
 * with the canonical value — no flicker, no double-spend.
 */
type ViewerListener = (delta: number, reason: string) => void;
const viewerListeners = new Set<ViewerListener>();
export function bumpViewerZaps(delta: number, reason = "optimistic") {
  if (delta === 0 || !Number.isFinite(delta)) return;
  for (const fn of Array.from(viewerListeners)) {
    try {
      fn(delta, reason);
    } catch {
      // a listener throwing must not break the others
    }
  }
}

/**
 * Module-level shared viewer cache.
 *
 * Without this, every component that calls `useViewer()` (topbar,
 * trade panel, composer, portfolio, …) maintains its own
 * `useState({viewer:null})` and triggers an independent fetch +
 * subscribe. Concretely that was producing the screenshot bug the
 * user flagged: topbar showed `9,999,999 ZAPS` (its viewer already
 * loaded), the trade panel showed `Balance after trade: 13` (its
 * viewer was still null, so it fell back to the Zustand `points`
 * default).
 *
 * Now every hook reads + writes through `sharedViewer` and broadcasts
 * changes to its peers via `stateListeners`. The first hook that
 * mounts kicks off the fetch + realtime subscription; subsequent
 * hooks get the cached value instantly and free-ride on the same
 * channel.
 */
type StateListener = (next: { viewer: Viewer | null; loading: boolean }) => void;
const stateListeners = new Set<StateListener>();
let sharedViewer: Viewer | null = null;
let sharedLoading = true;
let sharedFetchStarted = false;
let sharedFetchPromise: Promise<void> | null = null;

function broadcastViewerState() {
  for (const fn of Array.from(stateListeners)) {
    try {
      fn({ viewer: sharedViewer, loading: sharedLoading });
    } catch {
      // ignore
    }
  }
}

function setSharedViewer(next: Viewer | null, loading = false) {
  sharedViewer = next;
  sharedLoading = loading;
  broadcastViewerState();
}

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
  // Polish 5 — server-side quest + streak hydration payload. All
  // optional because the columns only exist after migration 0011 is
  // applied (clients without it just see undefined).
  quest_day?: string | null;
  quest_progress?: Record<string, number>;
  quest_claimed?: Record<string, boolean>;
  streak_current?: number;
  streak_longest?: number;
  streak_last_check_in?: string | null;
}

interface State {
  viewer: Viewer | null;
  loading: boolean;
}

// Identity columns guaranteed to exist in every deployment (migrations
// 0001+). The quest/streak columns (migration 0011) are appended only
// when available — see `fetchViewer` for the graceful fallback.
const BASE_PROFILE_COLUMNS =
  "id, username, name, avatar_url, banner_url, bio, zaps, is_admin, role, updated_at";
const EXTENDED_PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS}, quest_day, quest_progress, quest_claimed, streak_current, streak_longest, streak_last_check_in`;

async function fetchViewer(
  supabase: SupabaseClient,
): Promise<Viewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Polish 5 — pull quest + streak columns alongside the identity
  // payload so a single round-trip can re-hydrate the Zustand mirror.
  //
  // CRITICAL: PostgREST returns a hard 400 error (not undefined) when a
  // selected column does not exist. If migration 0011 has not been
  // applied to this database, selecting `quest_day` etc. fails the WHOLE
  // query — which would null out the viewer and make a signed-in user
  // look anonymous. So we try the extended select first and, only if it
  // errors, fall back to the always-present base columns. The quest /
  // streak fields then resolve to their client-side defaults.
  let row:
    | (Record<string, unknown> & { id: string })
    | null = null;
  const extended = await supabase
    .from("profiles")
    .select(EXTENDED_PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  if (extended.error) {
    // Most likely the 0011 columns are missing. Retry with base set so
    // identity + balance still resolve. Any other error (RLS, network)
    // also degrades gracefully to the base columns here.
    const base = await supabase
      .from("profiles")
      .select(BASE_PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
    row = (base.data as typeof row) ?? null;
  } else {
    row = (extended.data as typeof row) ?? null;
  }
  if (!row) return null;
  const r = row as {
    id: string;
    username?: string | null;
    name?: string | null;
    avatar_url?: string | null;
    banner_url?: string | null;
    bio?: string | null;
    zaps?: number | null;
    is_admin?: boolean | null;
    role?: string | null;
    updated_at?: string | null;
    quest_day?: string | null;
    quest_progress?: Record<string, number> | null;
    quest_claimed?: Record<string, boolean> | null;
    streak_current?: number | null;
    streak_longest?: number | null;
    streak_last_check_in?: string | null;
  };
  return {
    id: r.id,
    username: r.username ?? "",
    name: r.name ?? "",
    email: user.email ?? "",
    avatar_url: r.avatar_url ?? null,
    banner_url: r.banner_url ?? null,
    bio: r.bio ?? null,
    zaps: typeof r.zaps === "number" ? r.zaps : 0,
    is_admin: Boolean(r.is_admin) || r.role === "admin",
    updated_at: r.updated_at ?? new Date().toISOString(),
    quest_day: r.quest_day ?? null,
    quest_progress: r.quest_progress ?? {},
    quest_claimed: r.quest_claimed ?? {},
    streak_current: r.streak_current ?? 0,
    streak_longest: r.streak_longest ?? 0,
    streak_last_check_in: r.streak_last_check_in ?? null,
  };
}

export function useViewer(): State {
  const [state, setState] = useState<State>({
    viewer: sharedViewer,
    loading: sharedLoading,
  });

  // Subscribe to the shared cache so every useViewer caller sees the
  // same viewer the moment any one fetch resolves.
  useEffect(() => {
    const listener: StateListener = (next) => setState(next);
    stateListeners.add(listener);
    // Sync to current cache in case it changed before subscription.
    setState({ viewer: sharedViewer, loading: sharedLoading });
    return () => {
      stateListeners.delete(listener);
    };
  }, []);

  // Round-3 — wire this consumer into the global optimistic bus so
  // an in-flight trade can update the rendered balance immediately
  // across every mounted useViewer hook in the tree.
  useEffect(() => {
    const listener: ViewerListener = (delta) => {
      if (!sharedViewer) return;
      sharedViewer = {
        ...sharedViewer,
        zaps: Math.max(0, sharedViewer.zaps + delta),
      };
      broadcastViewerState();
    };
    viewerListeners.add(listener);
    return () => {
      viewerListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    // Only the first hook that mounts kicks off the fetch + realtime
    // subscription; subsequent hooks ride on the shared cache.
    if (sharedFetchStarted) return;
    sharedFetchStarted = true;

    if (!hasSupabaseEnv()) {
      setSharedViewer(null, false);
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
      // Date.now() + random suffix — two effect runs in the same
      // millisecond (React strict-mode double-mount) would otherwise
      // collide on the same channel key and the second `.on()` would
      // throw "cannot add postgres_changes callbacks ... after
      // subscribe()". The random tail makes every mount unique.
      const channelName = `viewer:${viewerId}:${Date.now()}:${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const channel = supabase.channel(channelName);
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${viewerId}`,
        },
        (payload) => {
          if (cancelled) return;
          // Fast path — apply the row delta directly. This is what makes
          // atomic Zap-economy updates (quest payouts, trade settlements
          // from migration 0011) reflect in the BalancePill the moment
          // Postgres broadcasts the change, without a second SELECT.
          const next = (payload as { new?: Record<string, unknown> }).new;
          if (next && typeof next === "object" && "zaps" in next) {
            if (!sharedViewer) return;
            sharedViewer = {
              ...sharedViewer,
              zaps:
                typeof next.zaps === "number"
                  ? next.zaps
                  : sharedViewer.zaps,
              name:
                typeof next.name === "string"
                  ? next.name
                  : sharedViewer.name,
              username:
                typeof next.username === "string"
                  ? next.username
                  : sharedViewer.username,
              bio:
                typeof next.bio === "string" || next.bio === null
                  ? (next.bio as string | null)
                  : sharedViewer.bio,
              avatar_url:
                typeof next.avatar_url === "string" || next.avatar_url === null
                  ? (next.avatar_url as string | null)
                  : sharedViewer.avatar_url,
              banner_url:
                typeof next.banner_url === "string" || next.banner_url === null
                  ? (next.banner_url as string | null)
                  : sharedViewer.banner_url,
              is_admin:
                Boolean(next.is_admin) ||
                (typeof next.role === "string" && next.role === "admin"),
              updated_at:
                typeof next.updated_at === "string"
                  ? next.updated_at
                  : new Date().toISOString(),
            };
            broadcastViewerState();
            return;
          }
          // Fallback — if Postgres didn't include the new row payload
          // (e.g. replica identity not set to FULL), do a refetch.
          fetchViewer(supabase).then((nextViewer) => {
            if (!cancelled) setSharedViewer(nextViewer, false);
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
        setSharedViewer(viewer, false);
        if (viewer) ensureChannel(viewer.id);
      } catch (err) {
        // Never block the rest of the app on a profile fetch failure
        // — set loading=false so gated clicks unblock.
        if (!cancelled) setSharedViewer(null, false);
        // eslint-disable-next-line no-console
        console.error("[useViewer] refresh failed:", err);
      }
    };

    // Initial fetch.
    sharedFetchPromise = refresh();

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
        setSharedViewer(null, false);
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
