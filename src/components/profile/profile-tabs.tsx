"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { PostCard } from "../post/post-card";
import { ZapMark } from "../zap-logo";
import { CategoryTag } from "../expert-badge";
import { useZapStore, type UserPost } from "@/lib/store";
import { posts, getMarket, type Category, type User } from "@/lib/fixtures";
import { cn } from "@/lib/utils";

export interface RealProfilePost {
  id: string;
  author_id: string;
  body_html: string;
  category_slug: string;
  market_id: string | null;
  images: string[];
  likes: number;
  comments_count: number;
  shares: number;
  created_at: string;
  boost_zaps?: number | null;
  boost_until?: string | null;
}

interface ProfileTabsProps {
  user: User;
  /**
   * Real posts loaded from Supabase (when the profile maps to a real user).
   * When present, these take precedence over mock data on the Posts tab.
   */
  realPosts?: RealProfilePost[] | null;
  /** True while the parent server is fetching/refreshing. */
  loading?: boolean;
}

const TABS = ["posts", "markets", "activity"] as const;
type TabId = (typeof TABS)[number];
const DEFAULT_TAB: TabId = "posts";

function realPostToUserPost(p: RealProfilePost, userId: string): UserPost {
  return {
    id: p.id,
    type: "user",
    userId,
    createdAt: p.created_at,
    body: p.body_html,
    category: (p.category_slug as Category) || undefined,
    marketId: p.market_id ?? undefined,
    images: Array.isArray(p.images) ? p.images : [],
    likes: p.likes ?? 0,
    comments: p.comments_count ?? 0,
    shares: p.shares ?? 0,
    views: 0,
    isMine: false,
    boostZaps: p.boost_zaps ?? undefined,
    boostUntil: p.boost_until ?? null,
    impressions: 0,
    clicks: 0,
    throttled: false,
    boostEarlyStoppedAt: null,
  };
}

export function ProfileTabs({ user, realPosts, loading }: ProfileTabsProps) {
  const userPosts = useZapStore(useShallow((s) => s.userPosts));
  const positions = useZapStore(useShallow((s) => s.positions));
  const isMe = user.username === "you";

  const [tab, setTab] = useState<TabId>(DEFAULT_TAB);
  const [hashReady, setHashReady] = useState(false);

  // Sync URL hash → tab (default to #posts).
  useEffect(() => {
    const readHash = () => {
      const h = (window.location.hash || "").replace("#", "") as TabId;
      if ((TABS as readonly string[]).includes(h)) {
        setTab(h);
      } else {
        setTab(DEFAULT_TAB);
      }
      setHashReady(true);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const onTabChange = (v: string) => {
    const next = v as TabId;
    setTab(next);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${next}`);
    }
  };

  const userMockPosts = useMemo(
    () => posts.filter((p) => p.userId === user.id),
    [user.id],
  );

  // Real Supabase posts win when present. Otherwise fall back to mock + local.
  const profilePosts = useMemo(() => {
    if (realPosts && realPosts.length >= 0) {
      const mapped = realPosts.map((p) => realPostToUserPost(p, user.id));
      // Newest first (DB already does this, but be defensive).
      mapped.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      // For the current user, merge in locally-created posts that haven't
      // been persisted yet so the prototype demo still feels live.
      if (isMe) {
        const localOnly = userPosts.filter(
          (p) => !mapped.some((r) => r.id === p.id),
        );
        return [...localOnly, ...mapped];
      }
      return mapped;
    }
    if (isMe) return [...userPosts, ...userMockPosts];
    return userMockPosts;
  }, [realPosts, isMe, userPosts, userMockPosts, user.id]);

  const userPredictions = useMemo(
    () => userMockPosts.filter((p) => p.type === "prediction"),
    [userMockPosts],
  );

  const userHoldings = useMemo(
    () =>
      isMe
        ? positions
        : userMockPosts
            .filter((p) => p.type === "prediction")
            .map((p: any) => ({
              marketId: p.marketId,
              side: p.side,
              shares: p.shares,
              avgPrice: p.avgPrice,
              staked: p.staked,
              openedAt: p.createdAt,
            })),
    [isMe, positions, userMockPosts],
  );

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="mt-8">
      <TabsList className="w-full md:w-auto overflow-x-auto no-scrollbar">
        <TabsTrigger value="posts">
          Posts{" "}
          <span className="text-[10px] font-mono text-[#5A6175] ml-1">
            {profilePosts.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="markets">
          Markets{" "}
          <span className="text-[10px] font-mono text-[#5A6175] ml-1">
            {userHoldings.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="activity">
          Activity{" "}
          <span className="text-[10px] font-mono text-[#5A6175] ml-1">
            {userPredictions.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts">
        <div className="space-y-3">
          {loading && hashReady && profilePosts.length === 0 ? (
            <PostSkeletonList />
          ) : profilePosts.length === 0 ? (
            <EmptyState
              title="No posts yet"
              cta={isMe ? "Write your first take →" : null}
              ctaHref="/feed"
            />
          ) : (
            profilePosts.map((p) => <PostCard key={p.id} post={p as any} />)
          )}
        </div>
      </TabsContent>

      <TabsContent value="markets">
        {userHoldings.length === 0 ? (
          <EmptyState
            title="No positions yet"
            cta={isMe ? "Make your first trade →" : null}
            ctaHref="/markets"
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {userHoldings.map((h, i) => {
              const m = getMarket(h.marketId);
              if (!m) return null;
              return (
                <Link
                  key={`${h.marketId}-${h.side}-${i}`}
                  href={`/market/${m.id}`}
                  className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-4 hover:border-[#353B4D] transition-colors"
                >
                  <CategoryTag category={m.category} asLink={false} />
                  <div className="mt-1 font-semibold text-[14px] line-clamp-2">
                    {m.question}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-mono">
                    <Cell
                      label="Side"
                      value={
                        <span
                          className={
                            h.side === "YES"
                              ? "text-[#00D982]"
                              : "text-[#FF4757]"
                          }
                        >
                          {h.side === "YES" ? "▲" : "▼"} {h.side}
                        </span>
                      }
                    />
                    <Cell label="Shares" value={h.shares.toLocaleString()} />
                    <Cell
                      label="Avg"
                      value={
                        <span className="inline-flex items-center">
                          {h.avgPrice}
                          <ZapMark />
                        </span>
                      }
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="activity">
        <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2A2F3D]">
            <h3 className="text-[13px] font-semibold">Resolved Predictions</h3>
          </div>
          {userPredictions.slice(0, 8).map((p, i) => {
            const m = getMarket((p as any).marketId);
            if (!m) return null;
            const won = i % 2 === 0;
            const pnl = won ? 120 + i * 30 : -(40 + i * 10);
            return (
              <Link
                key={p.id}
                href={`/market/${m.id}`}
                className="flex items-center gap-3 px-5 py-3 border-b border-[#2A2F3D] hover:bg-[#20232E]/40"
              >
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono font-bold",
                    won
                      ? "bg-[#00D982]/15 text-[#00D982]"
                      : "bg-[#FF4757]/15 text-[#FF4757]",
                  )}
                >
                  {won ? "WON" : "LOST"}
                </span>
                <div className="flex-1 min-w-0 text-sm font-medium truncate">
                  {m.question}
                </div>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums inline-flex items-center",
                    won ? "text-[#00D982]" : "text-[#FF4757]",
                  )}
                >
                  {won ? "+" : ""}
                  {pnl}
                  <ZapMark />
                </span>
              </Link>
            );
          })}
          {userPredictions.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[#8B92A8]">
              No resolved predictions yet.
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-[#5A6175]">
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  cta,
  ctaHref = "/markets",
}: {
  title: string;
  cta: string | null;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#2A2F3D] bg-[#14161D]/40 p-10 text-center">
      <div className="text-base text-[#8B92A8]">{title}</div>
      {cta && (
        <Link
          href={ctaHref}
          className="inline-block mt-3 text-sm font-semibold text-[#FFE600] hover:underline"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

function PostSkeletonList() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#2A2F3D]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-[#2A2F3D] rounded" />
              <div className="h-2 w-20 bg-[#2A2F3D] rounded" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full bg-[#2A2F3D] rounded" />
            <div className="h-3 w-3/4 bg-[#2A2F3D] rounded" />
            <div className="h-3 w-5/6 bg-[#2A2F3D] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
