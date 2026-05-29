"use server";

import { revalidatePath } from "next/cache";
import { createPost, togglePostLike, togglePostBookmark } from "@/lib/db/posts";
import { toggleMarketBookmark } from "@/lib/db/bookmarks";
import { createClient } from "@/lib/supabase/server";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { sanitizeHtmlServer, htmlToPlainTextServer } from "@/lib/sanitize-server";
import { fanoutNotifications } from "@/lib/db/notifications";
import { getCurrentProfile } from "@/lib/db/profiles";
import {
  CreatePostInput,
  CreateCommentInput,
  ToggleByUuid,
  FollowInput,
  formatZodError,
} from "@/lib/validation";

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

export async function createPostAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    await requireUser();
    const parsed = CreatePostInput.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: formatZodError(parsed.error) };
    }
    const v = parsed.data;
    const supabase = await createClient();
    const { data: cat, error: catErr } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", v.category_slug)
      .maybeSingle();
    if (catErr || !cat) {
      return { ok: false, error: "Unknown category" };
    }
    // Storage-layer sanitization. The client also sanitizes for rendering;
    // this ensures the DB row is safe even if a future surface skips that.
    const cleanHtml = sanitizeHtmlServer(v.body_html);
    if (!cleanHtml.trim()) {
      return { ok: false, error: "Post body is empty after sanitization" };
    }
    const row = await createPost({
      body_html: cleanHtml,
      category_id: cat.id as string,
      market_id: v.market_id ?? null,
      images: v.images ?? [],
      boost_zaps: v.boost_zaps,
      boost_until: v.boost_until ?? null,
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
  postId: unknown,
): Promise<Result<{ liked: boolean }>> {
  try {
    await requireUser();
    const parsed = ToggleByUuid.safeParse({ id: postId });
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const id = parsed.data.id;
    const { liked } = await togglePostLike(id);
    // Fire-and-forget: notify the post author on a fresh like. Wrap in
    // try/catch so a notification miss never breaks the like itself.
    if (liked) {
      try {
        const supabase = await createClient();
        const { data: post } = await supabase
          .from("posts")
          .select("author_id, body_html")
          .eq("id", id)
          .maybeSingle();
        const me = await getCurrentProfile();
        if (post?.author_id && me && post.author_id !== me.id) {
          await fanoutNotifications({
            recipientIds: [post.author_id],
            type: "like",
            actorId: me.id,
            payload: {
              actor_id: me.id,
              actor_name: me.name,
              actor_username: me.username,
              actor_avatar_url: me.avatar_url ?? null,
              post_id: id,
              body: htmlToPlainTextServer(post.body_html ?? "").slice(0, 160),
              href: `/post/${id}`,
            },
          });
        }
      } catch {
        // intentionally swallowed — notification failures must not
        // surface to the toggle path.
      }
    }
    return { ok: true, liked };
  } catch (err) {
    return notSignedIn<{ liked: boolean }>(err) ?? unknownErr<{ liked: boolean }>(err);
  }
}

export async function toggleBookmarkAction(
  postId: unknown,
): Promise<Result<{ bookmarked: boolean }>> {
  try {
    await requireUser();
    const parsed = ToggleByUuid.safeParse({ id: postId });
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const { bookmarked } = await togglePostBookmark(parsed.data.id);
    revalidatePath("/saved");
    return { ok: true, bookmarked };
  } catch (err) {
    return notSignedIn<{ bookmarked: boolean }>(err) ?? unknownErr<{ bookmarked: boolean }>(err);
  }
}

export async function toggleMarketBookmarkAction(
  marketId: unknown,
): Promise<Result<{ bookmarked: boolean }>> {
  try {
    await requireUser();
    const parsed = ToggleByUuid.safeParse({ id: marketId });
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const { bookmarked } = await toggleMarketBookmark(parsed.data.id);
    revalidatePath("/saved");
    return { ok: true, bookmarked };
  } catch (err) {
    return notSignedIn<{ bookmarked: boolean }>(err) ?? unknownErr<{ bookmarked: boolean }>(err);
  }
}

// ---------- Follow ----------

export async function toggleFollowAction(
  targetUserId: unknown,
): Promise<Result<{ following: boolean }>> {
  try {
    const user = await requireUser();
    const parsed = FollowInput.safeParse({ targetUserId });
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const target = parsed.data.targetUserId;
    if (user.id === target) {
      return { ok: false, error: "Can't follow yourself" };
    }
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followee_id", target)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followee_id", target);
      return { ok: true, following: false };
    }
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      followee_id: target,
    });
    if (error) return { ok: false, error: error.message };
    try {
      const me = await getCurrentProfile();
      if (me) {
        await fanoutNotifications({
          recipientIds: [target],
          type: "follow",
          actorId: me.id,
          payload: {
            actor_id: me.id,
            actor_name: me.name,
            actor_username: me.username,
            actor_avatar_url: me.avatar_url ?? null,
            href: `/profile/${me.username}`,
          },
        });
      }
    } catch {
      // notification miss is non-fatal
    }
    return { ok: true, following: true };
  } catch (err) {
    return notSignedIn<{ following: boolean }>(err) ?? unknownErr<{ following: boolean }>(err);
  }
}

// ---------- Comments ----------

export async function createCommentAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const user = await requireUser();
    const parsed = CreateCommentInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const v = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: v.postId,
        author_id: user.id,
        body: v.body,
        parent_id: v.parentId ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    const commentId = (data as { id: string }).id;

    // Notify the post author (or the parent comment author when this is
    // a reply). Skip self-notifications. Non-fatal on failure.
    try {
      const me = await getCurrentProfile();
      let recipientId: string | null = null;
      let kind: "comment" | "reply" = "comment";
      if (v.parentId) {
        const { data: parent } = await supabase
          .from("comments")
          .select("author_id")
          .eq("id", v.parentId)
          .maybeSingle();
        if (parent?.author_id) {
          recipientId = parent.author_id as string;
          kind = "reply";
        }
      } else {
        const { data: post } = await supabase
          .from("posts")
          .select("author_id")
          .eq("id", v.postId)
          .maybeSingle();
        if (post?.author_id) recipientId = post.author_id as string;
      }
      if (recipientId && me && recipientId !== me.id) {
        await fanoutNotifications({
          recipientIds: [recipientId],
          type: kind,
          actorId: me.id,
          payload: {
            actor_id: me.id,
            actor_name: me.name,
            actor_username: me.username,
            actor_avatar_url: me.avatar_url ?? null,
            post_id: v.postId,
            comment_id: commentId,
            body: v.body.slice(0, 200),
            href: `/post/${v.postId}#c-${commentId}`,
          },
        });
      }
    } catch {
      // non-fatal
    }
    return { ok: true, id: commentId };
  } catch (err) {
    return notSignedIn<{ id: string }>(err) ?? unknownErr<{ id: string }>(err);
  }
}
