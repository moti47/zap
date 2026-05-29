"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, Sparkles, Check } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { ExpertBadge } from "@/components/expert-badge";
import { Podium } from "@/components/leaderboard/podium";
import { Button } from "@/components/ui/button";
import { ZapMark } from "@/components/zap-logo";
import { useZapStore } from "@/lib/store";
import { users as fixtureUsers, CATEGORIES, type Category, type User } from "@/lib/fixtures";
import { cn, formatLargeNumber, categoryColor } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/db/leaderboard";

interface LeaderboardClientProps {
  /**
   * Real Supabase rows for the leaderboard. Empty array → render the
   * fixture data (demo mode or empty backend).
   */
  initialRows?: LeaderboardRow[];
}

type Range = "all-time" | "month" | "week";
const RANGES: { id: Range; label: string }[] = [
  { id: "all-time", label: "All Time" },
  { id: "month", label: "This Month" },
  { id: "week", label: "This Week" },
];

type CatTab = "overall" | Category;
const CAT_TABS: { id: CatTab; label: string }[] = [
  { id: "overall", label: "Overall" },
  ...CATEGORIES.map((c) => ({ id: c, label: c[0].toUpperCase() + c.slice(1) })),
];

/**
 * Adapt a real-DB leaderboard row to the User shape the existing
 * rendering code expects. Keeps the JSX untouched.
 */
function rowToUser(r: LeaderboardRow): User {
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    avatarUrl: r.avatarUrl ?? "",
    bio: "",
    joined: new Date(0).toISOString(),
    followers: 0,
    following: 0,
    totalPredictions: r.totalPredictions,
    pointsWon: r.pointsWon,
    expertScores: r.expertScores as User["expertScores"],
    brierScores: r.brierScores as User["brierScores"],
    predictionsByCategory: {},
    primaryCategory: r.primaryCategory as Category,
    verified: false,
    calibration: [],
  };
}

export function LeaderboardClient({ initialRows = [] }: LeaderboardClientProps) {
  const [range, setRange] = useState<Range>("all-time");
  const [cat, setCat] = useState<CatTab>("overall");
  const followingIds = useZapStore((s) => s.followingUserIds);
  const toggleFollow = useZapStore((s) => s.toggleFollow);

  // Real users from Supabase win. Fall back to fixtures only when the
  // server passed an empty list (demo mode or empty backend).
  const sourceUsers: User[] = useMemo(
    () => (initialRows.length > 0 ? initialRows.map(rowToUser) : fixtureUsers),
    [initialRows],
  );
  const isReal = initialRows.length > 0;

  const ranking = useMemo(() => {
    const scored = sourceUsers.map((u) => {
      const score =
        cat === "overall"
          ? (Object.values(u.expertScores).reduce<number>(
              (a, b) => a + (typeof b === "number" ? b : 0),
              0,
            )) /
            Math.max(1, Object.values(u.expertScores).length)
          : u.expertScores[cat] ?? 0;
      const adjusted =
        range === "week" ? score * 0.95 + 3 : range === "month" ? score * 0.98 + 1.5 : score;
      return { user: u, score: adjusted };
    });
    return scored.sort((a, b) => b.score - a.score);
  }, [cat, range, sourceUsers]);

  return (
    <div className="px-4 lg:px-6 py-6 pb-24 lg:pb-8 max-w-[1100px] mx-auto w-full">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            The Best Predictors
          </h1>
          <p className="mt-1 text-sm text-[#8B92A8]">
            Ranked by accuracy on resolved markets. Brier-score weighted.
          </p>
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-md border border-[#2A2F3D] bg-[#14161D]">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors",
                range === r.id
                  ? "bg-[#20232E] text-white shadow-[inset_0_0_0_1px_#353B4D]"
                  : "text-[#8B92A8] hover:text-white"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto no-scrollbar p-0.5">
        {CAT_TABS.map((t) => {
          const active = cat === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setCat(t.id)}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "text-white"
                  : "text-[#8B92A8] hover:text-white"
              )}
              style={
                active && t.id !== "overall"
                  ? { boxShadow: `inset 0 -2px 0 0 ${categoryColor(t.id as Category)}` }
                  : undefined
              }
            >
              {active && t.id === "overall" && (
                <motion.span
                  layoutId="cat-active"
                  className="absolute inset-0 rounded-md bg-[#20232E] border border-[#353B4D]"
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Podium */}
      <Podium ranking={ranking.slice(0, 3)} category={cat} />

      {/* Ranked list */}
      <div className="mt-8 rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2A2F3D] flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Full rankings</h3>
          <span className="text-[11px] font-mono text-[#5A6175]">
            {ranking.length} predictors · top {Math.min(50, ranking.length)} shown
          </span>
        </div>
        {ranking.slice(3, 50).map((r, i) => {
          const rank = i + 4;
          const u = r.user;
          const movement = i % 5 === 0 ? "up" : i % 7 === 0 ? "down" : i % 11 === 0 ? "new" : "stable";
          const following = followingIds.includes(u.id);
          return (
            <div
              key={u.id}
              className="flex items-center gap-4 px-5 py-3 border-b border-[#2A2F3D] hover:bg-[#20232E]/30 transition-colors"
            >
              <span className="font-mono text-sm text-[#8B92A8] w-8 tabular-nums">
                {rank}
              </span>
              <MovementBadge type={movement} delta={(rank % 3) + 1} />
              <Link href={`/profile/${u.username}`}>
                <UserAvatar
                  src={u.avatarUrl}
                  name={u.name}
                  category={u.primaryCategory}
                  size="sm"
                  showScore={false}
                />
              </Link>
              <Link
                href={`/profile/${u.username}`}
                className="flex-1 min-w-0 hover:text-[#FFE600]"
              >
                <div className="text-sm font-semibold truncate">{u.name}</div>
                <div className="text-[11px] font-mono text-[#5A6175] truncate">
                  @{u.username}
                </div>
              </Link>
              <div className="hidden md:flex items-center gap-6 font-mono text-[12px]">
                <Stat
                  label="Score"
                  value={
                    <span className="text-[#FFE600] text-lg font-bold">
                      {Math.round(r.score)}
                    </span>
                  }
                />
                <Stat
                  label="Brier"
                  value={(u.brierScores[u.primaryCategory] ?? 0.22).toFixed(3)}
                />
                <Stat label="Preds" value={u.totalPredictions.toLocaleString()} />
                <Stat
                  label="Won"
                  value={
                    <span className="inline-flex items-center">
                      {formatLargeNumber(u.pointsWon)}
                      <ZapMark />
                    </span>
                  }
                />
              </div>
              <span className="md:hidden text-base font-mono font-bold text-[#FFE600] tabular-nums">
                {Math.round(r.score)}
              </span>
              <Button
                size="sm"
                variant={following ? "secondary" : "outline"}
                onClick={() => toggleFollow(u.id)}
                className="h-7 px-3 text-[11px]"
              >
                {following ? (
                  <>
                    <Check className="h-3 w-3" /> Following
                  </>
                ) : (
                  "Follow"
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* User's position card */}
      <div className="mt-6 rounded-[14px] border border-[#FFE600]/30 bg-[#FFE600]/5 p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] font-bold">
          Y
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Your position: #{ranking.length + 1}</div>
          <div className="text-[11px] font-mono text-[#8B92A8]">
            Make a few more predictions to start climbing
          </div>
        </div>
        <Link
          href="/markets"
          className="text-[12px] font-mono font-semibold text-[#FFE600] hover:underline"
        >
          Browse markets →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center min-w-[60px]">
      <div className="text-[9px] uppercase tracking-widest text-[#5A6175]">{label}</div>
      <div className="text-white font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function MovementBadge({
  type,
  delta,
}: {
  type: "up" | "down" | "stable" | "new";
  delta: number;
}) {
  if (type === "new")
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 flex items-center gap-1">
        <Sparkles className="h-2.5 w-2.5" /> NEW
      </span>
    );
  if (type === "up")
    return (
      <span className="font-mono text-[10px] text-[#00D982] flex items-center gap-0.5 w-8">
        <ArrowUp className="h-3 w-3" />
        {delta}
      </span>
    );
  if (type === "down")
    return (
      <span className="font-mono text-[10px] text-[#FF4757] flex items-center gap-0.5 w-8">
        <ArrowDown className="h-3 w-3" />
        {delta}
      </span>
    );
  return (
    <span className="font-mono text-[10px] text-[#5A6175] flex items-center gap-0.5 w-8">
      <Minus className="h-3 w-3" />
    </span>
  );
}
