import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import type { MarketWithCategory } from "@/lib/db/markets";
import type { PostWithRelations } from "@/lib/db/posts";

export interface SearchResults {
  query: string;
  profiles: Pick<
    ProfileRow,
    "id" | "username" | "name" | "bio" | "avatar_url"
  >[];
  markets: MarketWithCategory[];
  posts: PostWithRelations[];
}

const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(id, username, name, avatar_url),
  category:categories!inner(slug, name, color),
  market:markets(id, question, yes_price, no_price)
`;
const MARKET_SELECT = `*, category:categories!inner(slug, name, color)`;

/**
 * Trigram-backed search across profiles, markets, and posts.
 * Returns empty arrays when the query is too short (<2 chars) so we don't
 * spam the database from auto-complete keystrokes.
 */
export async function searchAll(rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim();
  const empty: SearchResults = { query, profiles: [], markets: [], posts: [] };
  if (query.length < 2) return empty;
  const supabase = await createClient();

  // Use ilike against gin_trgm-indexed columns. Substring match keeps it
  // forgiving without exposing raw `to_tsquery` syntax to the user.
  const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [profilesRes, marketsRes, postsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, name, bio, avatar_url")
      .or(`username.ilike.${like},name.ilike.${like}`)
      .limit(8),
    supabase
      .from("markets")
      .select(MARKET_SELECT)
      .ilike("question", like)
      .order("total_volume", { ascending: false })
      .limit(8),
    supabase
      .from("posts")
      .select(POST_SELECT)
      .ilike("body_html", like)
      .order("exposure_score", { ascending: false })
      .limit(8),
  ]);

  return {
    query,
    profiles: (profilesRes.data ?? []) as SearchResults["profiles"],
    markets: (marketsRes.data ?? []) as MarketWithCategory[],
    posts: (postsRes.data ?? []) as PostWithRelations[],
  };
}

/**
 * Lightweight @mention lookup for the composer popover.
 */
export async function searchProfilesByPrefix(prefix: string, limit = 6) {
  const q = prefix.trim().replace(/[%_]/g, (m) => `\\${m}`);
  if (!q) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url")
    .or(`username.ilike.${q}%,name.ilike.${q}%`)
    .limit(limit);
  return data ?? [];
}
