"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { PostCard } from "./post/post-card";
import { PostComposer } from "./post/post-composer";
import { FeedTabs } from "./feed-tabs";
import { useZapStore, useHydrated, type UserPost } from "@/lib/store";
import { posts, getUser, getMarket } from "@/lib/fixtures";
import { computeExposure } from "@/lib/exposure";
import { Skeleton } from "./ui/skeleton";

export function FeedStream() {
  const hydrated = useHydrated();
  const userPosts = useZapStore(useShallow((s) => s.userPosts));
  const affinity = useZapStore((s) => s.affinity);
  const postImpressions = useZapStore(useShallow((s) => s.postImpressions));
  const cooldownEndsAt = useZapStore((s) => s.cooldownEndsAt);
  const [tab, setTab] = useState("for-you");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Merge user posts with seeded posts. Ranking is by exposure_score
  // computed locally so the prototype behaves the same as the
  // Supabase-backed feed.
  const merged = useMemo<(UserPost | (typeof posts)[number])[]>(() => {
    const all: (UserPost | (typeof posts)[number])[] = [...userPosts, ...posts];
    if (!hydrated) return all; // SSR: keep deterministic order
    const cooldownActive =
      !!cooldownEndsAt && new Date(cooldownEndsAt) > new Date();

    const scored = all.map((p) => {
      const isUser = (p as UserPost).type === "user";
      const userPost = isUser ? (p as UserPost) : null;
      const author = getUser((p as any).userId);
      const cat: string | undefined =
        (p as any).category ??
        (((p as any).marketId &&
          getMarket((p as any).marketId)?.category) as string | undefined) ??
        author?.primaryCategory;
      const expert = cat
        ? (author?.expertScores?.[cat as keyof typeof author.expertScores] ?? 50) / 100
        : 0.5;
      const impressions =
        userPost?.impressions ??
        postImpressions[(p as any).id] ??
        Math.max(20, (p as any).views ?? 0);
      const breakdown = computeExposure({
        expertScore: expert,
        likes: (p as any).likes ?? 0,
        comments: (p as any).comments ?? 0,
        shares: (p as any).shares ?? 0,
        impressions,
        createdAt: (p as any).createdAt,
        categoryAffinity: cat ? affinity[cat] ?? 0.3 : 0.3,
        boostZaps: userPost?.boostZaps,
        boostUntil: userPost?.boostUntil ?? null,
        throttled: userPost?.throttled,
        cooldownActive: cooldownActive && isUser,
      });
      return { post: p, score: breakdown.score, isUser };
    });

    scored.sort((a, b) => {
      // Pin the user's freshest-posted item to the top for clarity, then rank.
      if (a.isUser && !b.isUser) {
        if (Date.now() - new Date((a.post as any).createdAt).getTime() < 60_000)
          return -1;
      }
      if (b.isUser && !a.isUser) {
        if (Date.now() - new Date((b.post as any).createdAt).getTime() < 60_000)
          return 1;
      }
      return b.score - a.score;
    });
    return scored.map((x) => x.post);
  }, [userPosts, hydrated, affinity, postImpressions, cooldownEndsAt]);

  const filtered = useMemo(() => {
    switch (tab) {
      case "predictions":
        return merged.filter((p) => p.type === "prediction");
      case "markets":
        return merged.filter((p) => p.type === "market" || p.type === "launch");
      case "following":
        return merged.slice(0, 6);
      default:
        return merged;
    }
  }, [tab, merged]);

  return (
    <div className="flex flex-col gap-4">
      <PostComposer />
      <FeedTabs value={tab} onChange={setTab} />

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {filtered.map((post, idx) => (
              <motion.div
                key={post.id}
                layout
                initial={
                  hydrated && (post as UserPost).isMine
                    ? { opacity: 0, y: -16, scale: 0.98 }
                    : { opacity: 0, y: 6 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  delay: Math.min(idx * 0.03, 0.3),
                  duration: 0.35,
                }}
              >
                <PostCard
                  post={post as any}
                  isNew={(post as UserPost).isMine === true}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-[#2A2F3D] p-10 text-center text-[#8B92A8]">
              Nothing here yet — switch tabs or write a post.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
