"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Trophy,
  UserPlus,
  Check,
  Activity,
  Hash,
  Clock,
  Flame,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { UserAvatar } from "./user-avatar";
import { ExpertBadge, CategoryTag, LivePulseDot } from "./expert-badge";
import { ZapMark } from "./zap-logo";
import { Button } from "./ui/button";
import {
  trendingMarkets,
  topExperts,
  suggestedFollows,
  getUser,
  markets,
  CATEGORIES,
  type Category,
} from "@/lib/mock-data";
import { useZapStore, useHydrated } from "@/lib/store";
import { formatLargeNumber, timeAgo, timeUntil, categoryColor } from "@/lib/utils";

/**
 * Renders a date-derived string (timeAgo / timeUntil / …) only after the
 * client has hydrated. Server renders the fallback so SSR and the first
 * client paint match — preventing the noisy hydration warning we used to
 * get on the home page.
 */
function ClientTime({
  compute,
  fallback = "—",
}: {
  compute: () => string;
  fallback?: string;
}) {
  const hydrated = useHydrated();
  return (
    <span suppressHydrationWarning>{hydrated ? compute() : fallback}</span>
  );
}

export function RightSidebar() {
  const followingIds = useZapStore(useShallow((s) => s.followingUserIds));
  const toggleFollow = useZapStore((s) => s.toggleFollow);
  const allTrades = useZapStore(useShallow((s) => s.recentTrades));
  const livePrices = useZapStore((s) => s.marketPrices);

  const recentTrades = useMemo(() => allTrades.slice(0, 5), [allTrades]);
  const trending = useMemo(() => trendingMarkets(3), []);
  const experts = useMemo(() => topExperts(5), []);
  const suggestions = useMemo(() => suggestedFollows(4), []);

  // Aggregate total live volume + active markets
  const totals = useMemo(() => {
    let totalVolume = 0;
    let activeMarkets = 0;
    let resolvingSoon = 0;
    const now = Date.now();
    for (const m of markets) {
      const live = livePrices[m.id];
      totalVolume += live?.volume ?? m.totalVolume;
      activeMarkets += 1;
      const ms = new Date(m.resolutionDate).getTime() - now;
      if (ms > 0 && ms < 1000 * 60 * 60 * 48) resolvingSoon += 1;
    }
    return { totalVolume, activeMarkets, resolvingSoon };
  }, [livePrices]);

  // Trending topics derived from market category volume
  const trendingTopics = useMemo(() => {
    const tally: Record<Category, number> = {
      politics: 0,
      crypto: 0,
      sports: 0,
      tech: 0,
      economy: 0,
      entertainment: 0,
    };
    for (const m of markets) {
      const v = livePrices[m.id]?.volume ?? m.totalVolume;
      tally[m.category] += v;
    }
    return CATEGORIES.map((c) => ({ category: c, volume: tally[c] }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
  }, [livePrices]);

  // Markets that resolve in next 48h, sorted by closing time
  const closingSoon = useMemo(
    () =>
      [...markets]
        .filter(
          (m) =>
            new Date(m.resolutionDate).getTime() - Date.now() <
              1000 * 60 * 60 * 72 &&
            new Date(m.resolutionDate).getTime() > Date.now()
        )
        .sort(
          (a, b) =>
            new Date(a.resolutionDate).getTime() -
            new Date(b.resolutionDate).getTime()
        )
        .slice(0, 3),
    []
  );

  return (
    <aside
      aria-label="Sidebar"
      className="hidden xl:flex flex-col gap-4 w-[320px] shrink-0 sticky top-[4.5rem] self-start max-h-[calc(100vh-5rem)] overflow-y-auto thin-scrollbar pr-1"
    >
      {/* Pulse panel — site-wide live stats */}
      <div className="rounded-[14px] border border-[#FFE600]/20 bg-gradient-to-br from-[#1F1A0E] to-[#1A1D26] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold inline-flex items-center gap-2 uppercase tracking-widest text-white">
            <LivePulseDot /> Zap Pulse
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
            Last 24h
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Pulse
            label="Volume"
            value={
              <span className="inline-flex items-center justify-center">
                {formatLargeNumber(totals.totalVolume)}
                <ZapMark />
              </span>
            }
          />
          <Pulse
            label="Markets"
            value={totals.activeMarkets.toLocaleString()}
          />
          <Pulse
            label="Resolving"
            value={
              <span className="text-[#FFE600]">{totals.resolvingSoon}</span>
            }
          />
        </div>
      </div>

      {/* Trending topics */}
      <Panel
        icon={<Flame className="h-4 w-4 text-[#FF6B3D]" />}
        title="Trending Topics"
      >
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {trendingTopics.map(({ category, volume }) => {
            const color = categoryColor(category);
            return (
              <Link
                key={category}
                href={`/category/${category}`}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium capitalize transition-colors"
                style={{
                  borderColor: `${color}55`,
                  color,
                  background: `${color}10`,
                }}
              >
                <Hash className="h-3 w-3 opacity-70" />
                {category}
                <span className="text-[10px] font-mono opacity-70 group-hover:opacity-100">
                  {formatLargeNumber(volume)}
                </span>
              </Link>
            );
          })}
        </div>
      </Panel>

      {/* Trending markets */}
      <Panel
        icon={<TrendingUp className="h-4 w-4 text-[#FFE600]" />}
        title="Trending Markets"
        action={
          <Link
            href="/markets"
            className="text-[11px] font-mono text-[#5A6175] hover:text-white"
          >
            See all →
          </Link>
        }
      >
        {trending.map((m) => {
          const live = livePrices[m.id];
          const yesPrice = live?.yes ?? m.currentYesPrice;
          const volume = live?.volume ?? m.totalVolume;
          return (
            <Link
              key={m.id}
              href={`/market/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 border-t border-[#2A2F3D] hover:bg-[#20232E]/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <CategoryTag category={m.category} asLink={false} />
                <div className="text-[13px] mt-1 truncate font-medium">
                  {m.question}
                </div>
                <div className="text-[11px] font-mono text-[#5A6175] mt-1 inline-flex items-center gap-1.5">
                  <LivePulseDot />
                  {formatLargeNumber(volume)}
                  <ZapMark />
                  {" · "}
                  {m.traders.toLocaleString()} traders
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[15px] font-semibold text-[#00D982] inline-flex items-center">
                  {yesPrice}
                  <ZapMark />
                </span>
                <span className="font-mono text-[10px] text-[#8B92A8]">YES</span>
              </div>
            </Link>
          );
        })}
      </Panel>

      {/* Closing soon — countdown */}
      {closingSoon.length > 0 && (
        <Panel
          icon={<Clock className="h-4 w-4 text-[#FF4757]" />}
          title="Resolving Soon"
        >
          {closingSoon.map((m) => (
            <Link
              key={m.id}
              href={`/market/${m.id}`}
              className="flex items-start gap-3 px-4 py-3 border-t border-[#2A2F3D] hover:bg-[#20232E]/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <CategoryTag category={m.category} asLink={false} />
                <div className="text-[12.5px] mt-1 line-clamp-2 font-medium leading-snug">
                  {m.question}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
                  Closes in
                </div>
                <div className="text-[12px] font-mono font-semibold text-[#FF4757]">
                  <ClientTime
                    compute={() => timeUntil(m.resolutionDate)}
                    fallback="—"
                  />
                </div>
              </div>
            </Link>
          ))}
        </Panel>
      )}

      {/* Top experts */}
      <Panel
        icon={<Trophy className="h-4 w-4 text-[#FFB800]" />}
        title="Top Experts This Week"
        action={
          <Link
            href="/leaderboard"
            className="text-[11px] font-mono text-[#5A6175] hover:text-white"
          >
            See all →
          </Link>
        }
      >
        {experts.map((u, i) => (
          <div
            key={u.id}
            className="flex items-center gap-3 px-4 py-2.5 border-t border-[#2A2F3D]"
          >
            <span className="font-mono text-xs text-[#5A6175] w-5">{i + 1}</span>
            <Link href={`/profile/${u.username}`} className="shrink-0">
              <UserAvatar
                src={u.avatarUrl}
                name={u.name}
                size="sm"
                category={u.primaryCategory}
                showScore={false}
              />
            </Link>
            <Link
              href={`/profile/${u.username}`}
              className="flex-1 min-w-0 hover:text-[#FFE600]"
            >
              <div className="text-[13px] font-semibold truncate">{u.name}</div>
              <div className="text-[11px] font-mono text-[#5A6175] truncate">
                @{u.username}
              </div>
            </Link>
            <ExpertBadge
              category={u.primaryCategory}
              score={u.expertScores[u.primaryCategory] ?? 50}
            />
          </div>
        ))}
      </Panel>

      {/* Suggested follows */}
      <Panel
        icon={<UserPlus className="h-4 w-4 text-[#4DA3FF]" />}
        title="Suggested Follows"
      >
        {suggestions.map((u) => {
          const following = followingIds.includes(u.id);
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-2.5 border-t border-[#2A2F3D]"
            >
              <UserAvatar
                src={u.avatarUrl}
                name={u.name}
                size="sm"
                category={u.primaryCategory}
                showScore={false}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">
                  {u.name}
                </div>
                <div className="text-[11px] font-mono text-[#5A6175] truncate">
                  {formatLargeNumber(u.followers)} followers
                </div>
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="sm"
                  variant={following ? "secondary" : "default"}
                  onClick={() => toggleFollow(u.id)}
                  className="h-7 px-3 text-[11px]"
                  aria-pressed={following}
                >
                  {following ? (
                    <>
                      <Check className="h-3 w-3" /> Following
                    </>
                  ) : (
                    "Follow"
                  )}
                </Button>
              </motion.div>
            </div>
          );
        })}
      </Panel>

      {/* Live activity */}
      <Panel
        icon={<Activity className="h-4 w-4 text-[#00D982]" />}
        title={
          <span className="inline-flex items-center gap-2">
            Live Activity <LivePulseDot />
          </span>
        }
      >
        {recentTrades.length === 0 ? (
          <div className="px-4 py-4 text-[11px] font-mono text-[#5A6175] border-t border-[#2A2F3D]">
            Waiting for the next trade…
          </div>
        ) : (
          recentTrades.map((t) => {
            const u = getUser(t.userId);
            if (!u) return null;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 px-4 py-2 border-t border-[#2A2F3D] text-[11.5px] font-mono"
              >
                <span className="font-semibold truncate">
                  {u.name.split(" ")[0]}
                </span>
                <span
                  className={
                    t.side === "YES" ? "text-[#00D982]" : "text-[#FF4757]"
                  }
                >
                  {t.side === "YES" ? "▲" : "▼"} {t.shares}
                </span>
                <span className="text-[#5A6175]">@ {t.price}¢</span>
                <span className="ml-auto text-[#5A6175]">
                  <ClientTime
                    compute={() => timeAgo(t.timestamp)}
                    fallback="—"
                  />
                </span>
              </div>
            );
          })
        )}
      </Panel>

      <div className="text-[10px] font-mono text-[#5A6175] px-1 leading-relaxed">
        Zap is a play-money prediction market.
        <br />
        Predictions resolve via verified sources.
      </div>
    </aside>
  );
}

function Panel({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold inline-flex items-center gap-2">
          {icon} {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pulse({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-[#8B92A8]">
        {label}
      </div>
      <div className="text-base font-bold font-mono tabular-nums text-white mt-0.5">
        {value}
      </div>
    </div>
  );
}
