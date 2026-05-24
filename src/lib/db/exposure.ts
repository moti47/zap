import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  AffinityVector,
} from "@/lib/exposure";
import { updateAffinity, type AffinitySignal } from "@/lib/exposure";

/**
 * Recompute & cache exposure_score for a post via the Postgres function.
 * Safe to call from any server context — the SQL function does its own
 * row update.
 */
export async function recomputeExposure(postId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compute_exposure_score", {
    p_post_id: postId,
    p_viewer_id: null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Run the throttle check on a single post (idempotent). */
export async function checkPostThrottle(postId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_throttle", {
    p_post_id: postId,
  });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Record an impression. `dwellMs` and `clicked` may be updated later by
 * a second insert — we treat impressions as append-only events.
 */
export async function recordImpression(input: {
  postId: string;
  dwellMs?: number;
  clicked?: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("post_impressions").insert({
    post_id: input.postId,
    user_id: user?.id ?? null,
    dwell_ms: input.dwellMs ?? 0,
    clicked: input.clicked ?? false,
  });
  if (error) throw error;
}

/** Boost a post — debits zaps from the author and records the campaign. */
export async function startBoost(input: {
  postId: string;
  zaps: number;
  durationH: 1 | 4 | 24;
}): Promise<{ ok: true; ends_at: string } | { ok: false; reason: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_signed_in" };

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, zaps")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "no_profile" };
  if (profile.zaps < input.zaps) return { ok: false, reason: "insufficient_zaps" };

  const { data: post } = await svc
    .from("posts")
    .select("id, author_id, created_at")
    .eq("id", input.postId)
    .maybeSingle();
  if (!post) return { ok: false, reason: "no_post" };
  if (post.author_id !== user.id) return { ok: false, reason: "not_author" };

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + input.durationH * 3_600_000);

  await svc.from("boost_events").insert({
    post_id: input.postId,
    user_id: user.id,
    zaps: input.zaps,
    duration_h: input.durationH,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });

  await svc
    .from("posts")
    .update({
      boost_zaps: input.zaps,
      boost_until: endsAt.toISOString(),
    })
    .eq("id", input.postId);

  await svc
    .from("profiles")
    .update({ zaps: profile.zaps - input.zaps })
    .eq("id", user.id);

  await recomputeExposure(input.postId);

  return { ok: true, ends_at: endsAt.toISOString() };
}

/** Fetch boost performance metrics for the author's dashboard widget. */
export async function getBoostMetrics(postId: string): Promise<{
  impressions: number;
  clicks: number;
  ctr: number;
  engagement_rate: number;
  early_stopped: boolean;
  boost_zaps: number;
  boost_until: string | null;
}> {
  const supabase = await createClient();
  const [{ data: post }, { data: imp }, { data: events }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, boost_zaps, boost_until, likes, comments_count, shares")
      .eq("id", postId)
      .maybeSingle(),
    supabase
      .from("post_impressions")
      .select("clicked")
      .eq("post_id", postId),
    supabase
      .from("boost_events")
      .select("early_stopped_at")
      .eq("post_id", postId)
      .order("ends_at", { ascending: false })
      .limit(1),
  ]);

  const impressions = imp?.length ?? 0;
  const clicks = (imp ?? []).filter((r) => r.clicked).length;
  const eng =
    (post?.likes ?? 0) + (post?.comments_count ?? 0) + (post?.shares ?? 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    engagement_rate: impressions > 0 ? eng / impressions : 0,
    early_stopped: Boolean(events?.[0]?.early_stopped_at),
    boost_zaps: post?.boost_zaps ?? 0,
    boost_until: post?.boost_until ?? null,
  };
}

/**
 * Update viewer affinity from a signal (click / dwell / like / follow).
 * Merges in-place into profiles.affinity jsonb.
 */
export async function recordAffinitySignal(input: {
  categorySlug: string;
  signal: AffinitySignal;
}): Promise<AffinityVector | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("affinity")
    .eq("id", user.id)
    .maybeSingle();
  const current = ((profile?.affinity ?? {}) as AffinityVector) || {};
  const next = updateAffinity(current, input.categorySlug, input.signal);

  await supabase.from("profiles").update({ affinity: next }).eq("id", user.id);
  return next;
}
