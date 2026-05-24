"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { Bookmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { PostCard } from "./post/post-card";
import { MarketCardCompact } from "./market/market-card-compact";
import { useZapStore, useHydrated, type UserPost } from "@/lib/store";
import { posts, markets, type Category } from "@/lib/mock-data";
import { Skeleton } from "./ui/skeleton";

export interface SavedPostShape {
  id: string;
  body_html: string;
  category_slug: string;
  market_id: string | null;
  author_id: string;
  author_username: string;
  author_name: string;
  author_avatar_url: string | null;
  created_at: string;
  likes: number;
  comments_count: number;
  shares: number;
  images: string[];
}

export interface SavedMarketShape {
  id: string;
  question: string;
  category_slug: string;
  yes_price: number;
  no_price: number;
  total_volume: number;
  resolution_date: string;
}

interface SavedViewProps {
  /**
   * Server-fed Supabase bookmarks. When present (even empty arrays from
   * a logged-in user), they replace the local Zustand fallback.
   */
  initialPosts?: SavedPostShape[] | null;
  initialMarkets?: SavedMarketShape[] | null;
}

function savedPostToUserPost(p: SavedPostShape): UserPost {
  return {
    id: p.id,
    type: "user",
    userId: p.author_id,
    createdAt: p.created_at,
    body: p.body_html,
    category: (p.category_slug as Category) || undefined,
    marketId: p.market_id ?? undefined,
    images: p.images,
    likes: p.likes,
    comments: p.comments_count,
    shares: p.shares,
    views: 0,
  };
}

export function SavedView({
  initialPosts = null,
  initialMarkets = null,
}: SavedViewProps) {
  const hydrated = useHydrated();
  const bookmarkedPostIds = useZapStore(useShallow((s) => s.bookmarkedPostIds));
  const savedMarketIds = useZapStore(useShallow((s) => s.savedMarketIds));
  const userPosts = useZapStore(useShallow((s) => s.userPosts));

  const hasBackend = initialPosts !== null || initialMarkets !== null;

  const savedPostsLocal = useMemo(() => {
    const all = [...userPosts, ...posts];
    return bookmarkedPostIds
      .map((id) => all.find((p) => p.id === id))
      .filter(Boolean) as typeof all;
  }, [bookmarkedPostIds, userPosts]);

  const savedMarketsLocal = useMemo(() => {
    return savedMarketIds
      .map((id) => markets.find((m) => m.id === id))
      .filter(Boolean) as typeof markets;
  }, [savedMarketIds]);

  const [tab, setTab] = useState<"posts" | "markets">("posts");

  // URL hash sync (#posts / #markets) for parity with profile tabs.
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || "").replace("#", "");
      if (h === "markets") setTab("markets");
      else if (h === "posts") setTab("posts");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const onTabChange = (v: string) => {
    const next = v as "posts" | "markets";
    setTab(next);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${next}`);
    }
  };

  if (!hydrated && !hasBackend) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const savedPosts = initialPosts ?? savedPostsLocal;
  const savedMarkets = initialMarkets ?? savedMarketsLocal;
  const postCount = savedPosts.length;
  const marketCount = savedMarkets.length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 inline-flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-[#FFE600]" /> Saved
      </h1>
      <p className="text-sm text-[#8B92A8] mb-6">
        Bookmarked posts and markets, only visible to you.
      </p>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="posts">
            Saved Posts
            <span className="text-[10px] font-mono text-[#5A6175] ml-1">
              {postCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="markets">
            Saved Markets
            <span className="text-[10px] font-mono text-[#5A6175] ml-1">
              {marketCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <div className="space-y-3">
            {savedPosts.length === 0 ? (
              <EmptyState
                title="No saved posts yet"
                hint="Tap the bookmark icon on any post to save it for later."
              />
            ) : initialPosts ? (
              (initialPosts as SavedPostShape[]).map((p) => (
                <PostCard
                  key={p.id}
                  post={
                    {
                      ...savedPostToUserPost(p),
                      isMine: false,
                    } as any
                  }
                />
              ))
            ) : (
              (savedPostsLocal as any[]).map((p) => (
                <PostCard key={p.id} post={p as any} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="markets">
          <div className="grid md:grid-cols-2 gap-3">
            {savedMarkets.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState
                  title="No saved markets yet"
                  hint="Tap the bookmark icon on any market card to save it."
                />
              </div>
            ) : initialMarkets ? (
              (initialMarkets as SavedMarketShape[]).map((m) => (
                <Link
                  key={m.id}
                  href={`/market/${m.id}`}
                  className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-4 hover:border-[#353B4D] transition-colors"
                >
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
                    {m.category_slug}
                  </div>
                  <div className="mt-1 font-semibold text-[14px] line-clamp-2">
                    {m.question}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <div className="text-[9px] uppercase text-[#5A6175]">
                        YES
                      </div>
                      <div className="font-bold text-[#00D982]">
                        {Math.round(m.yes_price)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-[#5A6175]">
                        Volume
                      </div>
                      <div>{m.total_volume.toLocaleString()}⚡</div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              (savedMarketsLocal as any[]).map((m) => (
                <MarketCardCompact key={m.id} market={m} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#2A2F3D] bg-[#14161D]/40 p-10 text-center">
      <div className="text-base text-white font-medium">{title}</div>
      <div className="text-sm text-[#8B92A8] mt-1">{hint}</div>
      <Link
        href="/feed"
        className="inline-block mt-4 text-sm font-semibold text-[#FFE600] hover:underline"
      >
        Go to feed →
      </Link>
    </div>
  );
}
