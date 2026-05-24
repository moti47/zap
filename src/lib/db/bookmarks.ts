import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PostWithRelations } from "@/lib/db/posts";
import type { MarketWithCategory } from "@/lib/db/markets";

export interface SavedBundle {
  posts: PostWithRelations[];
  markets: MarketWithCategory[];
}

const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(id, username, name, avatar_url),
  category:categories!inner(slug, name, color),
  market:markets(id, question, yes_price, no_price)
`;

const MARKET_SELECT = `*, category:categories!inner(slug, name, color)`;

export async function listMyBookmarks(): Promise<SavedBundle> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { posts: [], markets: [] };

  const { data: rows } = await supabase
    .from("bookmarks")
    .select("post_id, market_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const postIds = (rows ?? []).map((r) => r.post_id).filter(Boolean) as string[];
  const marketIds = (rows ?? [])
    .map((r) => r.market_id)
    .filter(Boolean) as string[];

  const [postRes, marketRes] = await Promise.all([
    postIds.length
      ? supabase.from("posts").select(POST_SELECT).in("id", postIds)
      : Promise.resolve({ data: [] as PostWithRelations[] }),
    marketIds.length
      ? supabase.from("markets").select(MARKET_SELECT).in("id", marketIds)
      : Promise.resolve({ data: [] as MarketWithCategory[] }),
  ]);

  // Preserve bookmark order.
  const postById = new Map(
    ((postRes.data ?? []) as PostWithRelations[]).map((p) => [p.id, p]),
  );
  const marketById = new Map(
    ((marketRes.data ?? []) as MarketWithCategory[]).map((m) => [m.id, m]),
  );

  const posts: PostWithRelations[] = [];
  const markets: MarketWithCategory[] = [];
  for (const r of rows ?? []) {
    if (r.post_id) {
      const p = postById.get(r.post_id);
      if (p) {
        (p as PostWithRelations).bookmarked_by_me = true;
        posts.push(p);
      }
    } else if (r.market_id) {
      const m = marketById.get(r.market_id);
      if (m) markets.push(m);
    }
  }

  return { posts, markets };
}

export async function toggleMarketBookmark(marketId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("market_id", marketId)
    .maybeSingle();
  if (existing) {
    await supabase.from("bookmarks").delete().eq("id", existing.id);
    return { bookmarked: false };
  }
  await supabase
    .from("bookmarks")
    .insert({ user_id: user.id, market_id: marketId });
  return { bookmarked: true };
}
