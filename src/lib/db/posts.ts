import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PostRow } from "@/lib/supabase/types";
import type { AffinityVector } from "@/lib/exposure";

export type PostWithRelations = PostRow & {
  author: {
    id: string;
    username: string;
    name: string;
    avatar_url: string | null;
  };
  category: { slug: string; name: string; color: string };
  market: {
    id: string;
    question: string;
    yes_price: number;
    no_price: number;
  } | null;
  liked_by_me?: boolean;
  bookmarked_by_me?: boolean;
};

const SELECT = `
  *,
  author:profiles!posts_author_id_fkey(id, username, name, avatar_url),
  category:categories!inner(slug, name, color),
  market:markets(id, question, yes_price, no_price)
`;

export async function listFeed(opts?: {
  limit?: number;
  categorySlug?: string;
  authorId?: string;
}): Promise<PostWithRelations[]> {
  const supabase = await createClient();
  let q = supabase
    .from("posts")
    .select(SELECT)
    .limit(opts?.limit ?? 50);

  // Phase 6 will replace this with exposure_score ordering. For now,
  // exposure_score is computed but newest still wins ties.
  q = q
    .order("exposure_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.categorySlug) q = q.eq("category.slug", opts.categorySlug);
  if (opts?.authorId) q = q.eq("author_id", opts.authorId);

  const { data } = await q;
  const posts = (data ?? []) as PostWithRelations[];

  // Hydrate liked_by_me / bookmarked_by_me for the current viewer.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Phase 6: personalize ranking with the viewer's category affinity vector.
  if (user && posts.length) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("affinity")
      .eq("id", user.id)
      .maybeSingle();
    const aff = ((profile?.affinity ?? {}) as AffinityVector) || {};
    posts.sort((a, b) => {
      const liftA = (aff[a.category.slug] ?? 0.3) * 0.1;
      const liftB = (aff[b.category.slug] ?? 0.3) * 0.1;
      return b.exposure_score + liftB - (a.exposure_score + liftA);
    });
  }

  if (user && posts.length) {
    const ids = posts.map((p) => p.id);
    const [{ data: likes }, { data: bookmarks }] = await Promise.all([
      supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", ids),
      supabase
        .from("bookmarks")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", ids),
    ]);
    const likedSet = new Set((likes ?? []).map((l) => l.post_id));
    const bookmarkedSet = new Set(
      (bookmarks ?? []).map((b) => b.post_id).filter(Boolean) as string[],
    );
    for (const p of posts) {
      p.liked_by_me = likedSet.has(p.id);
      p.bookmarked_by_me = bookmarkedSet.has(p.id);
    }
  }

  return posts;
}

export async function getPost(id: string): Promise<PostWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as PostWithRelations | null) ?? null;
}

export async function listPostsByAuthor(
  authorId: string,
  limit = 50,
): Promise<PostWithRelations[]> {
  return listFeed({ authorId, limit });
}

export async function createPost(input: {
  body_html: string;
  category_id: string;
  market_id?: string | null;
  images?: string[];
  boost_zaps?: number;
  boost_until?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      body_html: input.body_html,
      category_id: input.category_id,
      market_id: input.market_id ?? null,
      images: input.images ?? [],
      boost_zaps: input.boost_zaps ?? 0,
      boost_until: input.boost_until ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePostLike(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);
    return { liked: false };
  }
  await supabase.from("post_likes").insert({ user_id: user.id, post_id: postId });
  return { liked: true };
}

export async function togglePostBookmark(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) {
    await supabase.from("bookmarks").delete().eq("id", existing.id);
    return { bookmarked: false };
  }
  await supabase
    .from("bookmarks")
    .insert({ user_id: user.id, post_id: postId });
  return { bookmarked: true };
}
