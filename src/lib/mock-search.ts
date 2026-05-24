/**
 * Prototype fallback for `/api/search` when Supabase isn't configured.
 * Mirrors the shape returned by `lib/db/search.searchAll`.
 */
import { users, markets, posts, getMarket } from "./fixtures";

export interface MockSearchResults {
  query: string;
  profiles: {
    id: string;
    username: string;
    name: string;
    avatar_url: string | null;
    bio: string | null;
  }[];
  markets: any[];
  posts: any[];
}

export function mockSearch(q: string): MockSearchResults {
  const needle = q.toLowerCase();
  const profiles = users
    .filter(
      (u) =>
        u.name.toLowerCase().includes(needle) ||
        u.username.toLowerCase().includes(needle),
    )
    .slice(0, 8)
    .map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatar_url: u.avatarUrl,
      bio: u.bio,
    }));

  const matchingMarkets = markets
    .filter((m) => m.question.toLowerCase().includes(needle))
    .slice(0, 8)
    .map((m) => ({
      id: m.id,
      question: m.question,
      description: m.description,
      category_id: m.category,
      yes_price: m.currentYesPrice,
      no_price: m.currentNoPrice,
      total_volume: m.totalVolume,
      resolution_date: m.resolutionDate,
      status: "open",
      outcome: null,
      created_at: m.createdAt,
      category: {
        slug: m.category,
        name: m.category,
        color: "#FFE600",
      },
    }));

  const matchingPosts = posts
    .filter((p: any) =>
      (p.body ?? "").toLowerCase().includes(needle),
    )
    .slice(0, 8)
    .map((p: any) => {
      const market = p.marketId ? getMarket(p.marketId) : null;
      return {
        id: p.id,
        body_html: p.body,
        author_id: p.userId,
        category_id: market?.category ?? "general",
        market_id: p.marketId ?? null,
        images: [],
        likes: p.likes,
        comments_count: p.comments,
        shares: p.shares,
        boost_zaps: 0,
        boost_until: null,
        exposure_score: 0,
        throttled: false,
        created_at: p.createdAt,
        author: { id: p.userId, username: "user", name: "User", avatar_url: null },
        category: {
          slug: market?.category ?? "general",
          name: market?.category ?? "General",
          color: "#FFE600",
        },
        market: market
          ? {
              id: market.id,
              question: market.question,
              yes_price: market.currentYesPrice,
              no_price: market.currentNoPrice,
            }
          : null,
      };
    });

  return {
    query: q,
    profiles,
    markets: matchingMarkets,
    posts: matchingPosts,
  };
}
