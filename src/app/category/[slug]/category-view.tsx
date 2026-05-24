"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Trophy, MessageSquare } from "lucide-react";
import {
  markets,
  posts as seedPosts,
  users,
  CATEGORIES,
  type Category,
} from "@/lib/mock-data";
import { useShallow } from "zustand/react/shallow";
import { useZapStore, useHydrated } from "@/lib/store";
import { categoryColor, formatLargeNumber, timeUntil } from "@/lib/utils";
import { PostCard } from "@/components/post/post-card";
import { CategoryTag, ExpertBadge, LivePulseDot } from "@/components/expert-badge";
import { UserAvatar } from "@/components/user-avatar";
import { ZapMark } from "@/components/zap-logo";
import { Sparkline } from "@/components/market/sparkline";

export function CategoryView({ category }: { category: Category }) {
  const hydrated = useHydrated();
  const livePrices = useZapStore((s) => s.marketPrices);
  const userPosts = useZapStore(useShallow((s) => s.userPosts));
  const color = categoryColor(category);

  const catMarkets = useMemo(
    () =>
      [...markets]
        .filter((m) => m.category === category)
        .sort(
          (a, b) =>
            (livePrices[b.id]?.volume ?? b.totalVolume) -
            (livePrices[a.id]?.volume ?? a.totalVolume)
        ),
    [category, livePrices]
  );

  const totals = useMemo(() => {
    let totalVolume = 0;
    let traders = 0;
    for (const m of catMarkets) {
      totalVolume += livePrices[m.id]?.volume ?? m.totalVolume;
      traders += m.traders;
    }
    return { totalVolume, traders };
  }, [catMarkets, livePrices]);

  const catExperts = useMemo(
    () =>
      [...users]
        .map((u) => ({ u, score: u.expertScores[category] ?? 0 }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6),
    [category]
  );

  const catPosts = useMemo(() => {
    const merged = [...userPosts, ...seedPosts];
    return merged.filter((p) => {
      // user posts have explicit category; seed posts have `category` for prediction/market types
      const c = (p as { category?: Category }).category;
      if (c) return c === category;
      // launch / market posts → derive from attached market
      const mid = (p as { marketId?: string }).marketId;
      if (mid) {
        const m = markets.find((mm) => mm.id === mid);
        return m?.category === category;
      }
      return false;
    });
  }, [userPosts, category]);

  return (
    <div>
      {/* Hero */}
      <div
        className="rounded-[14px] border p-6 mb-6"
        style={{
          borderColor: `${color}44`,
          background: `linear-gradient(135deg, ${color}10, #1A1D26 70%)`,
        }}
      >
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-[#8B92A8] hover:text-white mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> All markets
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#8B92A8]">
              Category
            </div>
            <h1
              className="text-3xl font-bold tracking-tight capitalize mt-0.5"
              style={{ color }}
            >
              # {category}
            </h1>
            <p className="text-sm text-[#8B92A8] mt-1 max-w-md">
              Every market, expert, and post tagged{" "}
              <span className="text-white">{category}</span> on Zap.
            </p>
          </div>
          <div className="flex gap-4">
            <Stat
              label="Markets"
              value={catMarkets.length.toLocaleString()}
            />
            <Stat
              label="Volume"
              value={
                <span className="inline-flex items-center">
                  {formatLargeNumber(totals.totalVolume)}
                  <ZapMark />
                </span>
              }
            />
            <Stat label="Traders" value={totals.traders.toLocaleString()} />
          </div>
        </div>

        {/* Category jump strip */}
        <div className="mt-5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] mr-1">
            Jump to:
          </span>
          {CATEGORIES.filter((c) => c !== category).map((c) => {
            const cc = categoryColor(c);
            return (
              <Link
                key={c}
                href={`/category/${c}`}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium capitalize transition-colors"
                style={{
                  borderColor: "#2A2F3D",
                  color: "#8B92A8",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: cc }}
                />
                {c}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: posts + markets */}
        <div className="space-y-6 min-w-0">
          {/* Markets */}
          <section>
            <h2 className="text-[13px] font-semibold inline-flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4" style={{ color }} />
              Top markets in {category}
            </h2>
            {catMarkets.length === 0 ? (
              <EmptyState text={`No markets in ${category} yet.`} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {catMarkets.slice(0, 6).map((m) => {
                  const live = livePrices[m.id];
                  const yesPrice = live?.yes ?? m.currentYesPrice;
                  const noPrice = live?.no ?? m.currentNoPrice;
                  const volume = live?.volume ?? m.totalVolume;
                  return (
                    <Link
                      key={m.id}
                      href={`/market/${m.id}`}
                      className="group rounded-md border border-[#2A2F3D] bg-[#1A1D26] p-3 hover:border-[#353B4D] flex flex-col gap-2"
                    >
                      <CategoryTag category={m.category} asLink={false} />
                      <h3 className="font-semibold text-[13.5px] leading-snug line-clamp-2 group-hover:text-[#FFE600]">
                        {m.question}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-[#00D982] font-bold inline-flex items-center">
                          YES {yesPrice}
                          <ZapMark />
                        </span>
                        <span className="text-[#FF4757] font-bold inline-flex items-center">
                          NO {noPrice}
                          <ZapMark />
                        </span>
                        <div className="ml-auto">
                          <Sparkline
                            data={m.priceHistory.slice(-30)}
                            positive={yesPrice >= m.currentYesPrice}
                          />
                        </div>
                      </div>
                      <div
                        className="text-[10.5px] font-mono text-[#8B92A8] inline-flex items-center gap-1.5"
                        suppressHydrationWarning
                      >
                        <LivePulseDot />
                        {formatLargeNumber(volume)}
                        <ZapMark />
                        {" · "}
                        {hydrated ? timeUntil(m.resolutionDate) : "—"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {catMarkets.length > 6 && (
              <div className="mt-3 text-right">
                <Link
                  href={`/catalog?cat=${category}`}
                  className="text-[12px] font-mono text-[#FFE600] hover:underline"
                >
                  Browse all {catMarkets.length} →
                </Link>
              </div>
            )}
          </section>

          {/* Posts */}
          <section>
            <h2 className="text-[13px] font-semibold inline-flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-[#4DA3FF]" />
              Recent posts
            </h2>
            {catPosts.length === 0 ? (
              <EmptyState text="No posts in this category yet." />
            ) : (
              <div className="space-y-3">
                {catPosts.slice(0, 8).map((p) => (
                  <PostCard key={p.id} post={p as never} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: experts */}
        <aside className="space-y-3">
          <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-[13px] font-semibold inline-flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#FFB800]" /> Top experts
              </h3>
              <p className="text-[11px] text-[#8B92A8] mt-0.5">
                Highest calibrated forecasters in {category}.
              </p>
            </div>
            {catExperts.length === 0 ? (
              <div className="px-4 py-4 border-t border-[#2A2F3D]">
                <EmptyState text="No experts yet." />
              </div>
            ) : (
              catExperts.map((x, i) => (
                <div
                  key={x.u.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-t border-[#2A2F3D]"
                >
                  <span className="font-mono text-xs text-[#5A6175] w-5">
                    {i + 1}
                  </span>
                  <Link href={`/profile/${x.u.username}`} className="shrink-0">
                    <UserAvatar
                      src={x.u.avatarUrl}
                      name={x.u.name}
                      size="sm"
                      category={x.u.primaryCategory}
                      showScore={false}
                    />
                  </Link>
                  <Link
                    href={`/profile/${x.u.username}`}
                    className="flex-1 min-w-0 hover:text-[#FFE600]"
                  >
                    <div className="text-[13px] font-semibold truncate">
                      {x.u.name}
                    </div>
                    <div className="text-[11px] font-mono text-[#5A6175] truncate">
                      @{x.u.username}
                    </div>
                  </Link>
                  <ExpertBadge category={category} score={x.score} />
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
        {label}
      </div>
      <div className="text-xl font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#2A2F3D] p-6 text-center text-sm text-[#8B92A8]">
      {text}
    </div>
  );
}
