"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { ChevronUp } from "lucide-react";
import { PostCard } from "./post/post-card";
import { PostComposer } from "./post/post-composer";
import { FeedTabs } from "./feed-tabs";
import { FeedFilterChips } from "./feed-filter-chips";
import { CategoryPicker } from "./post/category-picker";
import Link from "next/link";
import { useZapStore, useHydrated, type UserPost } from "@/lib/store";
import { useIsSignedIn } from "@/lib/require-sign-in";
import { posts, getUser, getMarket } from "@/lib/fixtures";
import { isDemoMode } from "@/lib/demo-mode";
import {
  scorePost,
  makeSnapshot,
  sessionBucket,
  type FeedSnapshot,
  type RankablePost,
  type PersonalizedBreakdown,
} from "@/lib/ranking";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

type FeedItem = UserPost | (typeof posts)[number];

const SKELETON_COUNT = 3;
const STABLE_THRESHOLD_MS = 250;

/**
 * Phase 11+ Feed.
 *
 *   - Order is FROZEN at the moment a batch is fetched.
 *   - Likes / comments / impressions can update *counts* but never
 *     mutate the order while the user is scrolling.
 *   - New realtime posts accumulate behind a sticky "X new posts" pill;
 *     clicking the pill computes a fresh snapshot.
 *   - First 3 skeletons render instantly; data streams in after.
 *   - Personalization: 92% high-affinity + 8% adjacent explore picks.
 */
interface ServerPost {
  id: string;
  body_html: string;
  category?: { slug: string } | null;
  market_id: string | null;
  author_id: string;
  author?: { id: string; username: string; name: string; avatar_url: string | null };
  images: string[] | null;
  likes: number;
  comments_count: number;
  shares: number;
  created_at: string;
  exposure_score?: number;
  liked_by_me?: boolean;
  bookmarked_by_me?: boolean;
}

interface FeedStreamProps {
  initialServerPosts?: ServerPost[];
}

// Convert a Supabase post row into the UserPost shape the FeedItem
// renderer + ranking pipeline already understand.
function serverPostToUserPost(p: ServerPost): UserPost {
  return {
    id: p.id,
    type: "user",
    userId: p.author_id,
    createdAt: p.created_at,
    body: p.body_html,
    category: (p.category?.slug as UserPost["category"]) ?? undefined,
    marketId: p.market_id ?? undefined,
    images: Array.isArray(p.images) ? p.images : undefined,
    likes: p.likes ?? 0,
    comments: p.comments_count ?? 0,
    shares: p.shares ?? 0,
    views: 0,
    isMine: false,
    impressions: 0,
    clicks: 0,
    throttled: false,
    boostEarlyStoppedAt: null,
    // Preserve author metadata so PostCard can display real users that
    // aren't in the fixture list.
    authorName: p.author?.name,
    authorUsername: p.author?.username,
    authorAvatar: p.author?.avatar_url ?? null,
  };
}

const PAGE_SIZE = 12;

export function FeedStream({ initialServerPosts = [] }: FeedStreamProps) {
  const hydrated = useHydrated();
  // Item #1 — wait until the viewer is resolved before deciding which
  // composer surface to render. Otherwise SIGNED_IN users see a brief
  // "Join Zap to post your take" flash while useViewer is still
  // loading the profile row, which is the exact "split-state" bug.
  const { isSignedIn, loading: authLoading } = useIsSignedIn();
  const userPosts = useZapStore(useShallow((s) => s.userPosts));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const affinityGraph = useZapStore((s) => s.affinityGraph);
  const sessionState = useZapStore((s) => s.session);
  const postImpressions = useZapStore(useShallow((s) => s.postImpressions));
  const cooldownEndsAt = useZapStore((s) => s.cooldownEndsAt);
  const ensureDailyQuests = useZapStore((s) => s.ensureDailyQuests);
  const touchStreak = useZapStore((s) => s.touchStreak);
  // Item #4 — local muted/blocked author ids. Any post whose userId
  // matches is filtered out before ranking.
  const blockedAuthorIds = useZapStore(useShallow((s) => s.blockedAuthorIds));
  const [tab, setTab] = useState("for-you");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Snapshot lives in a ref so updates to viewer affinity / counts do
  // NOT force a re-rank. The order changes only when:
  //   - the user explicitly refreshes (pill click)
  //   - the tab changes
  //   - the user creates a new post (own posts pin to top inside the snapshot)
  const [snapshot, setSnapshot] = useState<FeedSnapshot<FeedItem> | null>(null);
  const [pendingNewPosts, setPendingNewPosts] = useState<FeedItem[]>([]);

  // Skeleton-first paint. Show shell + 3 skeletons instantly, snapshot
  // resolves on the next microtask.
  const [paintLoading, setPaintLoading] = useState(true);

  // -------------------------------------------------------------------
  // Daily quests + streak on mount.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    ensureDailyQuests();
    touchStreak();
    // run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // -------------------------------------------------------------------
  // Build a snapshot from the current pool. Only re-runs on:
  //   - hydrate, tab change, manual refresh.
  // NOT on every like / dwell / impression. That's the whole point.
  // -------------------------------------------------------------------
  const buildSnapshot = useCallback(
    (pool: FeedItem[]): FeedSnapshot<FeedItem> => {
      const now = Date.now();
      const bucket = sessionBucket();
      const cooldownActive =
        !!cooldownEndsAt && new Date(cooldownEndsAt) > new Date();

      const scored = pool.map((p) => {
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

        const rankable: RankablePost = {
          id: (p as any).id,
          createdAt: (p as any).createdAt,
          authorId: (p as any).userId,
          category: cat,
          hashtags: [],
          contentFormat: (p as any).images?.length
            ? "image"
            : ((p as any).body?.length ?? 0) > 280
              ? "long_form"
              : "short",
          marketBehavior: (p as any).marketId ? "binary" : undefined,
          likes: (p as any).likes ?? 0,
          comments: (p as any).comments ?? 0,
          shares: (p as any).shares ?? 0,
          impressions,
          expertPercentile: expert,
          boostZaps: userPost?.boostZaps,
          boostUntil: userPost?.boostUntil ?? null,
          authorCooldown: cooldownActive && isUser,
          throttled: userPost?.throttled,
        };
        const breakdown = scorePost(
          rankable,
          { ...affinityGraph, session_patterns: { ...affinityGraph.session_patterns, [bucket]: 0.7 } },
          sessionState,
          now,
        );
        return { post: p, breakdown };
      });

      // Pin the viewer's brand-new posts to the very top within the
      // snapshot for clarity (same behavior as before).
      scored.sort((a, b) => {
        const aIsUserFresh =
          (a.post as UserPost).type === "user" &&
          Date.now() - new Date((a.post as any).createdAt).getTime() < 60_000;
        const bIsUserFresh =
          (b.post as UserPost).type === "user" &&
          Date.now() - new Date((b.post as any).createdAt).getTime() < 60_000;
        if (aIsUserFresh && !bIsUserFresh) return -1;
        if (bIsUserFresh && !aIsUserFresh) return 1;
        return b.breakdown.finalScore - a.breakdown.finalScore;
      });

      return makeSnapshot(scored);
    },
    [affinityGraph, sessionState, cooldownEndsAt, postImpressions],
  );

  // -------------------------------------------------------------------
  // Initial paint: snapshot built on mount and on tab change. Not on
  // every interaction.
  // -------------------------------------------------------------------
  // Source ordering:
  //   1. Local optimistic userPosts (Zustand — newest items the viewer just
  //      composed; persist server-side too)
  //   2. Real Supabase posts when env is configured + the page server-fetched
  //      them. De-duplicated against userPosts by id so an optimistic add
  //      doesn't double-render once it lands in the DB.
  //   3. Fixture demo posts as a fallback (no env / no rows yet)
  const demo = isDemoMode();
  const allItems = useMemo<FeedItem[]>(() => {
    const userIds = new Set(userPosts.map((p) => p.id));
    const serverItems = initialServerPosts
      .filter((sp) => !userIds.has(sp.id))
      .map(serverPostToUserPost);
    if (serverItems.length > 0) {
      return [...userPosts, ...serverItems];
    }
    // Real backend mode: never fall back to fixture posts — show
    // whatever the user has authored locally (optimistic) plus an empty
    // state instead. Fixtures only mix in for demo / no-backend mode.
    if (!demo) {
      return [...userPosts];
    }
    return [...userPosts, ...posts];
  }, [userPosts, initialServerPosts, demo]);

  // Persist the original allItems used for the active snapshot so
  // realtime additions can be detected.
  const snapshotIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hydrated) return;
    let t = setTimeout(() => {
      try {
        const snap = buildSnapshot(allItems);
        snapshotIdsRef.current = new Set(snap.items.map((p) => (p as any).id));
        setSnapshot(snap);
        setPendingNewPosts([]);
      } catch {
        // buildSnapshot shouldn't throw, but if it does don't leave the
        // feed stuck in the skeleton state forever.
      } finally {
        setPaintLoading(false);
      }
    }, STABLE_THRESHOLD_MS);
    return () => clearTimeout(t);
    // Intentionally exclude buildSnapshot / allItems so we don't reshuffle.
    // We re-snapshot on tab change (effect below) and on refresh-pill click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tab]);

  // Detect new arrivals (e.g. composer pushed a new post or realtime
  // delivered one) and queue them behind the pill.
  useEffect(() => {
    if (!snapshot) return;
    const inSnapshot = snapshotIdsRef.current;
    const fresh = allItems.filter((p) => !inSnapshot.has((p as any).id));
    if (fresh.length === 0) {
      // existing pool shrunk or stayed the same — clear stale pending
      if (pendingNewPosts.length > 0) setPendingNewPosts([]);
      return;
    }
    // If the user just published, slot it inline (own posts always pin),
    // skip the pill. Otherwise queue behind the pill.
    const myFresh = fresh.filter((p) => (p as UserPost).isMine);
    const othersFresh = fresh.filter((p) => !(p as UserPost).isMine);
    if (myFresh.length > 0) {
      const snap = buildSnapshot(allItems);
      snapshotIdsRef.current = new Set(snap.items.map((p) => (p as any).id));
      setSnapshot(snap);
      setPendingNewPosts(othersFresh);
      return;
    }
    setPendingNewPosts(othersFresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, snapshot]);

  const refresh = useCallback(() => {
    setPaintLoading(true);
    setPendingNewPosts([]);
    const snap = buildSnapshot(allItems);
    snapshotIdsRef.current = new Set(snap.items.map((p) => (p as any).id));
    setSnapshot(snap);
    setPaintLoading(false);
    // scroll back to the top so the user sees the new posts
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [allItems, buildSnapshot]);

  const filtered = useMemo<FeedItem[]>(() => {
    if (!snapshot) return [];
    let items: FeedItem[];
    switch (tab) {
      case "predictions":
        items = snapshot.items.filter((p) => p.type === "prediction");
        break;
      case "markets":
        items = snapshot.items.filter(
          (p) => p.type === "market" || p.type === "launch",
        );
        break;
      case "following":
        items = snapshot.items.slice(0, 6);
        break;
      default:
        items = snapshot.items;
    }
    if (categoryFilter) {
      items = items.filter((p) => (p as any).category === categoryFilter);
    }
    // Item #4 — drop posts whose author the viewer has blocked.
    if (blockedAuthorIds.length > 0) {
      const blocked = new Set(blockedAuthorIds);
      items = items.filter((p) => !blocked.has((p as any).userId));
    }
    return items;
  }, [tab, snapshot, categoryFilter, blockedAuthorIds]);

  return (
    <div className="flex flex-col gap-4">
      {authLoading ? (
        // Neutral placeholder while we resolve whether the viewer is
        // signed in — prevents the Topbar/Container split-state flash.
        <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] h-[120px]" />
      ) : isSignedIn ? (
        <PostComposer />
      ) : (
        <div className="rounded-[14px] border border-[#2A2F3D] bg-gradient-to-br from-[#1A1D26] to-[#14161D] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">
              Join Zap to post your take
            </h3>
            <p className="text-[12.5px] text-[#8B92A8] mt-1">
              Sign in to publish posts, comment, trade markets, and earn Zaps.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/auth/sign-in?next=/"
              className="inline-flex items-center px-3 h-9 rounded-md text-[12.5px] font-semibold text-white border border-[#2A2F3D] hover:border-[#FFE600]/40 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up?next=/"
              className="inline-flex items-center px-3 h-9 rounded-md text-[12.5px] font-bold bg-[#FFE600] text-[#0E1016] hover:scale-[1.03] active:scale-95 transition-transform"
            >
              Create account
            </Link>
          </div>
        </div>
      )}
      <FeedTabs value={tab} onChange={setTab} />

      <FeedFilterChips
        value={categoryFilter}
        onChange={setCategoryFilter}
        onOpenPicker={() => setPickerOpen(true)}
      />

      {/* Category picker bottom-sheet (opens from "More" chip) */}
      <CategoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={categoryFilter as any}
        onChange={(cat) => {
          setCategoryFilter(cat);
          setPickerOpen(false);
        }}
      />

      <AnimatePresence>
        {pendingNewPosts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-[4.5rem] z-30 flex justify-center"
          >
            <button
              type="button"
              onClick={refresh}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full",
                "bg-[#FFE600] text-[#0E1016] text-xs font-bold shadow-lg",
                "hover:scale-[1.03] active:scale-95 transition-transform",
                "border border-[#FFE600]/60",
              )}
              aria-label={`Refresh feed with ${pendingNewPosts.length} new posts`}
            >
              <ChevronUp className="h-3.5 w-3.5" />
              {pendingNewPosts.length} new post{pendingNewPosts.length === 1 ? "" : "s"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {paintLoading && (
        <div className="space-y-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
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

      {!paintLoading && snapshot && (
        <div className="space-y-4">
          {/* Infinite feed: when we run out of unique posts, the
              cycledItems array repeats from index 0. Keys include a
              cycle suffix so React doesn't think it's the same node. */}
          {(() => {
            if (filtered.length === 0) {
              return (
                <div className="rounded-[14px] border border-dashed border-[#2A2F3D] p-10 text-center text-[#8B92A8]">
                  Nothing here yet — switch tabs or write a post.
                </div>
              );
            }
            const rows = [];
            for (let i = 0; i < visibleCount; i++) {
              const post = filtered[i % filtered.length];
              const cycle = Math.floor(i / filtered.length);
              const id = (post as any).id;
              const breakdown = snapshot.breakdowns[id];
              const isExplore = snapshot.scores[id] !== undefined;
              rows.push(
                <FeedItemRow
                  key={cycle === 0 ? id : `${id}-cycle${cycle}`}
                  post={post}
                  breakdown={breakdown}
                  isExplore={isExplore}
                />,
              );
            }
            return rows;
          })()}
          {/* Sentinel — when it scrolls into view, load more rows. */}
          {filtered.length > 0 && (
            <InfiniteSentinel
              ref={loadMoreSentinelRef}
              onIntersect={() =>
                setVisibleCount((n) => Math.min(n + PAGE_SIZE, 240))
              }
              maxed={visibleCount >= 240}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Memoized post row. Critically: this row is keyed by post.id and does
 * NOT re-mount when the parent re-renders due to count updates. Order
 * inside the parent is stable, so React reuses the DOM node.
 */
function FeedItemRow({
  post,
  breakdown,
}: {
  post: FeedItem;
  breakdown: PersonalizedBreakdown | undefined;
  isExplore: boolean;
}) {
  // Initial entrance animation. We mount with opacity:1 / y:0 to avoid
  // visible motion on already-rendered posts. Newly-inserted own posts
  // get a fade-in driven by `isMine + recent`.
  const isMine = (post as UserPost).isMine === true;
  const isFreshOwn =
    isMine &&
    Date.now() - new Date((post as any).createdAt).getTime() < 5000;

  return (
    <motion.div
      // No layout prop — we explicitly do NOT want framer reflowing the
      // list when likes/comments update; the parent already renders in
      // a fixed order.
      initial={
        isFreshOwn ? { opacity: 0, y: -16, scale: 0.98 } : false
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28 }}
    >
      <PostCard
        post={post as any}
        isNew={isFreshOwn}
        rankingBreakdown={breakdown}
      />
    </motion.div>
  );
}

/**
 * Sentinel for the infinite feed. Loads PAGE_SIZE more rows whenever
 * it scrolls into view. Renders nothing when we've hit the soft cap
 * (so the page doesn't accidentally grow unbounded).
 */
const InfiniteSentinel = React.forwardRef<
  HTMLDivElement,
  { onIntersect: () => void; maxed: boolean }
>(function InfiniteSentinel({ onIntersect, maxed }, ref) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) onIntersect();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onIntersect]);
  if (maxed) return null;
  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="h-px"
      aria-hidden
    />
  );
});
