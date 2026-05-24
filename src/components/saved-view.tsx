"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { Bookmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { PostCard } from "./post/post-card";
import { MarketCardCompact } from "./market/market-card-compact";
import { useZapStore, useHydrated } from "@/lib/store";
import { posts, markets } from "@/lib/mock-data";
import { Skeleton } from "./ui/skeleton";

export function SavedView() {
  const hydrated = useHydrated();
  const bookmarkedPostIds = useZapStore(useShallow((s) => s.bookmarkedPostIds));
  const savedMarketIds = useZapStore(useShallow((s) => s.savedMarketIds));
  const userPosts = useZapStore(useShallow((s) => s.userPosts));

  const savedPosts = useMemo(() => {
    const all = [...userPosts, ...posts];
    return bookmarkedPostIds
      .map((id) => all.find((p) => p.id === id))
      .filter(Boolean) as typeof all;
  }, [bookmarkedPostIds, userPosts]);

  const savedMarkets = useMemo(() => {
    return savedMarketIds
      .map((id) => markets.find((m) => m.id === id))
      .filter(Boolean) as typeof markets;
  }, [savedMarketIds]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 inline-flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-[#FFE600]" /> Saved
      </h1>
      <p className="text-sm text-[#8B92A8] mb-6">
        Bookmarked posts and markets, only visible to you.
      </p>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">
            Saved Posts
            <span className="text-[10px] font-mono text-[#5A6175] ml-1">
              {savedPosts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="markets">
            Saved Markets
            <span className="text-[10px] font-mono text-[#5A6175] ml-1">
              {savedMarkets.length}
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
            ) : (
              savedPosts.map((p) => <PostCard key={p.id} post={p as any} />)
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
            ) : (
              savedMarkets.map((m) => <MarketCardCompact key={m.id} market={m} />)
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
