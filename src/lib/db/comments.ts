import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CommentRow } from "@/lib/supabase/types";

export type CommentWithAuthor = CommentRow & {
  author: {
    id: string;
    username: string;
    name: string;
    avatar_url: string | null;
  };
  liked_by_me?: boolean;
};

export type CommentNode = CommentWithAuthor & { children: CommentNode[] };

export async function listComments(postId: string): Promise<CommentNode[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select(
      `*, author:profiles!comments_author_id_fkey(id, username, name, avatar_url)`,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const list = (data ?? []) as CommentWithAuthor[];

  // Hydrate liked_by_me.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && list.length) {
    const ids = list.map((c) => c.id);
    const { data: likes } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .in("comment_id", ids);
    const likedSet = new Set((likes ?? []).map((l) => l.comment_id));
    for (const c of list) c.liked_by_me = likedSet.has(c.id);
  }

  // Build tree by parent_id.
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const c of list) byId.set(c.id, { ...c, children: [] });
  for (const c of list) {
    const node = byId.get(c.id)!;
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createComment(input: {
  post_id: string;
  body: string;
  parent_id?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: input.post_id,
      body: input.body,
      parent_id: input.parent_id ?? null,
      author_id: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleCommentLike(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", user.id)
    .eq("comment_id", commentId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("comment_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("comment_id", commentId);
    return { liked: false };
  }
  await supabase
    .from("comment_likes")
    .insert({ user_id: user.id, comment_id: commentId });
  return { liked: true };
}
