"use server";

import { revalidatePath } from "next/cache";
import { createPost, togglePostLike, togglePostBookmark } from "@/lib/db/posts";
import { createClient } from "@/lib/supabase/server";
import { requireUser, NotSignedInError } from "@/lib/auth";

/**
 * Real-data interaction server actions.
 *
 * The client calls these from the composer, like button, bookmark
 * button, follow button. They:
 *   - require an authenticated user (anonymous → 401-ish error)
 *   - persist via the typed `lib/db/*` helpers
 *   - revalidate the relevant RSC paths so other surfaces refresh
 *
 * All return `{ ok, ...payload } | { ok: false, error }` so the
 * caller can show a toast without throwing.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function notSignedIn<T>(err: unknown): Result<T> | null {
  if (err instanceof NotSignedInError) {
    return { ok: false, error: err.message } as Result<T>;
  }
  return null;
}

function unknownErr<T>(err: unknown): Result<T> {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

// ---------- Posts ----------

export async function createPostAction(input: {
  body_html: string;
  category_slug: string;
  market_id?: string | null;
  images?: string[];
  boost_zaps?: number;
  boost_until?: string | null;
}): Promise<Result<{ id: string }>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: cat, error: catErr } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", input.category_slug)
      .maybeSingle();
    if (catErr || !cat) {
      return { ok: false, error: "Unknown category" };
    }
    const row = await createPost({
      body_html: input.body_html,
      category_id: cat.id as string,
      market_id: input.market_id ?? null,
      images: input.images ?? [],
      boost_zaps: input.boost_zaps,
      boost_until: input.boost_until ?? null,
    });
    revalidatePath("/");
    revalidatePath("/feed");
    revalidatePath("/profile/you");
    return { ok: true, id: (row as { id: string }).id };
  } catch (err) {
    return notSignedIn<{ id: string }>(err) ?? unknownErr<{ id: string }>(err);
  }
}

export async function toggleLikeAction(
  postId: string,
): Promise<Result<{ liked: boolean }>> {
  try {
    await requireUser();
    const { liked } = await togglePostLike(postId);
    return { ok: true, liked };
  } catch (err) {
    return notSignedIn<{ liked: boolean }>(err) ?? unknownErr<{ liked: boolean }>(err);
  }
}

export async function toggleBookmarkAction(
  postId: string,
): Promise<Result<{ bookmarked: boolean }>> {
  try {
    await requireUser();
    const { bookmarked } = await togglePostBookmark(postId);
    revalidatePath("/saved");
    return { ok: true, bookmarked };
  } catch (err) {
    return notSignedIn<{ bookmarked: boolean }>(err) ?? unknownErr<{ bookmarked: boolean }>(err);
  }
}

// ---------- Follow ----------

export async function toggleFollowAction(
  targetUserId: string,
): Promise<Result<{ following: boolean }>> {
  try {
    const user = await requireUser();
    if (user.id === targetUserId) {
      return { ok: false, error: "Can't follow yourself" };
    }
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followee_id", targetUserId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followee_id", targetUserId);
      return { ok: true, following: false };
    }
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      followee_id: targetUserId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, following: true };
  } catch (err) {
    return notSignedIn<{ following: boolean }>(err) ?? unknownErr<{ following: boolean }>(err);
  }
}

// ---------- Comments ----------

export async function createCommentAction(input: {
  postId: string;
  body: string;
  parentId?: string | null;
}): Promise<Result<{ id: string }>> {
  try {
    const user = await requireUser();
    const body = input.body.trim();
    if (body.length < 1 || body.length > 5000) {
      return { ok: false, error: "Comment must be 1–5000 chars" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: input.postId,
        author_id: user.id,
        body,
        parent_id: input.parentId ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id: string }).id };
  } catch (err) {
    return notSignedIn<{ id: string }>(err) ?? unknownErr<{ id: string }>(err);
  }
}
