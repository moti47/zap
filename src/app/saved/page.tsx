import {
  SavedView,
  type SavedPostShape,
  type SavedMarketShape,
} from "@/components/saved-view";
import { listMyBookmarks } from "@/lib/db/bookmarks";
import { getCurrentProfile } from "@/lib/db/profiles";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  let initialPosts: SavedPostShape[] | null = null;
  let initialMarkets: SavedMarketShape[] | null = null;

  try {
    // Parallel: profile lookup + bookmarks fetch. listMyBookmarks
    // re-reads auth.getUser() so it's safe to fire alongside the
    // profile check.
    const [me, bundle] = await Promise.all([
      getCurrentProfile(),
      listMyBookmarks().catch(() => ({ posts: [], markets: [] })),
    ]);
    if (me) {
      initialPosts = bundle.posts.map((p) => ({
        id: p.id,
        body_html: p.body_html,
        category_slug: p.category?.slug ?? "general",
        market_id: p.market_id,
        author_id: p.author.id,
        author_username: p.author.username,
        author_name: p.author.name,
        author_avatar_url: p.author.avatar_url,
        created_at: p.created_at,
        likes: p.likes,
        comments_count: p.comments_count,
        shares: p.shares,
        images: Array.isArray(p.images) ? p.images : [],
      }));
      initialMarkets = bundle.markets.map((m) => ({
        id: m.id,
        question: m.question,
        category_slug: m.category?.slug ?? "general",
        yes_price: m.yes_price,
        no_price: m.no_price,
        total_volume: m.total_volume,
        resolution_date: m.resolution_date,
      }));
    }
  } catch {
    initialPosts = null;
    initialMarkets = null;
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-[820px] mx-auto w-full">
      <SavedView initialPosts={initialPosts} initialMarkets={initialMarkets} />
    </div>
  );
}
