"use client";

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Image as ImageIcon,
  MessageCircle,
  Heart,
  UserPlus,
  TrendingUp,
  Bookmark,
  Eye,
  Link2,
  Reply,
  Share2,
  Star,
  Users,
  Check,
  Flame,
  RefreshCw,
  Trophy,
  Zap as ZapIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHydrated, useZapStore } from "@/lib/store";
import {
  questProgressFromCounts,
  type ActiveQuest,
  type QuestKind,
} from "@/lib/quests";
import {
  tierForStreak,
  nextTier,
  STREAK_TIERS,
} from "@/lib/streaks";
import { ZapMark } from "./zap-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ICONS: Record<QuestKind, React.ComponentType<{ className?: string }>> = {
  create_post: Pencil,
  create_post_image: ImageIcon,
  comment_twice: MessageCircle,
  like_5: Heart,
  follow_1: UserPlus,
  trade_market: TrendingUp,
  save_3: Bookmark,
  read_10_full: Eye,
  attach_market: Link2,
  reply_comment: Reply,
  share_1: Share2,
  bookmark_2: Star,
  open_profile_3: Users,
};

export function QuestsView() {
  const hydrated = useHydrated();
  const ensureDailyQuests = useZapStore((s) => s.ensureDailyQuests);
  const touchStreak = useZapStore((s) => s.touchStreak);
  const activeQuests = useZapStore(useShallow((s) => s.activeQuests));
  const counts = useZapStore((s) => s.questCounts);
  const claimed = useZapStore((s) => s.questClaimed);
  const claimQuest = useZapStore((s) => s.claimQuest);
  const streak = useZapStore((s) => s.streak);
  const ledger = useZapStore(useShallow((s) => s.zapLedger.slice(0, 8)));
  const spendRecovery = useZapStore((s) => s.spendRecovery);
  const points = useZapStore((s) => s.points);

  useEffect(() => {
    if (!hydrated) return;
    ensureDailyQuests();
    touchStreak();
  }, [hydrated, ensureDailyQuests, touchStreak]);

  const rows = useMemo(
    () => questProgressFromCounts(activeQuests, counts, claimed),
    [activeQuests, counts, claimed],
  );

  const totalReward = activeQuests.reduce((s, q) => s + q.reward, 0);
  const claimedTotal = rows
    .filter((r) => r.claimed)
    .reduce((s, r) => s + r.reward, 0);
  const allClaimed = rows.length > 0 && rows.every((r) => r.claimed);

  const tier = tierForStreak(streak.currentStreak);
  const next = nextTier(streak.currentStreak);
  const progressToNext = next
    ? Math.min(
        100,
        Math.round(
          ((streak.currentStreak - tier.min) / (next.min - tier.min)) * 100,
        ),
      )
    : 100;

  const handleRecover = () => {
    if (spendRecovery()) {
      toast.success("Streak recovered ✨", {
        description: "Your streak is safe — keep it alive tomorrow.",
      });
    }
  };

  if (!hydrated) {
    return (
      <div className="text-[#8B92A8] text-sm">Loading your quests…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page hero */}
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600]">
            Daily
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Quests &amp; streaks
          </h1>
          <p className="text-[13px] text-[#8B92A8] mt-1 max-w-[480px]">
            Three quests a day, refreshed every morning. Earn Zaps, climb
            streak tiers, and unlock boost discounts.
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
            Balance
          </div>
          <div className="inline-flex items-center gap-1.5 text-lg font-bold text-white">
            <ZapMark className="h-4 w-4 text-[#FFE600]" />
            {points.toLocaleString()}
          </div>
        </div>
      </header>

      {/* Streak hero */}
      <section
        className="rounded-[18px] border overflow-hidden relative"
        style={{
          borderColor: `${tier.color}33`,
          background: `linear-gradient(135deg, ${tier.color}10, transparent 60%), #14161D`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(60% 80% at 100% 0%, ${tier.color}55, transparent 60%)`,
          }}
        />
        <div className="relative grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-4 p-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, -3, 3, 0],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ color: tier.color }}
              >
                <Flame className="h-5 w-5" />
              </motion.div>
              <span
                className="text-[10.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
                style={{
                  color: tier.color,
                  borderColor: `${tier.color}55`,
                  background: `${tier.color}14`,
                }}
              >
                {tier.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <motion.span
                key={streak.currentStreak}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="text-6xl sm:text-7xl font-extrabold tabular-nums leading-none"
                style={{
                  color: tier.color,
                  textShadow:
                    tier.min > 0 ? `0 0 40px ${tier.color}55` : "none",
                }}
              >
                {streak.currentStreak}
              </motion.span>
              <span className="text-[12px] uppercase tracking-widest text-[#8B92A8]">
                day{streak.currentStreak === 1 ? "" : "s"} in a row
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3 text-[12px] text-[#8B92A8]">
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-[#FFB800]" />
                Longest{" "}
                <span className="font-mono text-white">
                  {streak.longestStreak}
                </span>
              </span>
              <span className="text-[#353B4D]">·</span>
              <span>
                Boost discount{" "}
                <span className="font-mono text-[#FFE600]">
                  {tier.boostDiscountPct}%
                </span>
              </span>
            </div>

            {next && (
              <div className="mt-4">
                <div className="relative h-2 rounded-full bg-[#0E1016] overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${progressToNext}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 28 }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${tier.color}, ${next.color})`,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-[#5A6175]">
                  <span>{tier.label}</span>
                  <span>
                    {next.min - streak.currentStreak} to {next.label}
                  </span>
                </div>
              </div>
            )}

            {streak.pendingRecoveryFor && streak.recoveriesAvailable > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-md border border-[#FFE600]/40 bg-[#FFE600]/8 p-3"
              >
                <div className="text-[12px] font-semibold text-white mb-1">
                  Use your recovery?
                </div>
                <div className="text-[11px] text-[#8B92A8] mb-2">
                  You missed one day. Spend your free recovery to keep the
                  streak alive — you&apos;ll earn another at 7 days.
                </div>
                <button
                  type="button"
                  onClick={handleRecover}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md bg-[#FFE600] text-[#0E1016] hover:scale-[1.03] active:scale-95 transition-transform"
                >
                  <RefreshCw className="h-3 w-3" /> Recover streak
                </button>
              </motion.div>
            )}
          </div>

          {/* Tier ladder */}
          <div className="rounded-[12px] bg-[#0E1016]/60 border border-[#2A2F3D] p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] mb-2">
              Tier ladder
            </div>
            <ul className="space-y-1.5">
              {STREAK_TIERS.map((t) => {
                const reached = streak.currentStreak >= t.min;
                const current = t.label === tier.label;
                return (
                  <li
                    key={t.label}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-[11.5px] transition-all",
                      current
                        ? "bg-white/5"
                        : reached
                          ? "opacity-90"
                          : "opacity-50",
                    )}
                  >
                    <span
                      className="h-5 w-5 rounded-full grid place-items-center text-[10px]"
                      style={{
                        background: reached ? `${t.color}22` : "#0E1016",
                        border: `1px solid ${reached ? t.color : "#2A2F3D"}`,
                        color: t.color,
                      }}
                    >
                      {reached ? "✓" : ""}
                    </span>
                    <span
                      className="font-semibold flex-1"
                      style={{ color: current ? t.color : "white" }}
                    >
                      {t.label}
                    </span>
                    <span className="font-mono text-[10px] text-[#5A6175]">
                      {t.min}d
                    </span>
                    {t.boostDiscountPct > 0 && (
                      <span className="font-mono text-[10px] text-[#FFE600]">
                        -{t.boostDiscountPct}%
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Quests grid */}
      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
        <header className="px-5 py-4 flex items-center justify-between border-b border-[#2A2F3D]">
          <div>
            <h2 className="text-base font-bold text-white">Today&apos;s quests</h2>
            <p className="text-[11.5px] text-[#8B92A8] mt-0.5">
              Refreshes at midnight local time
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
              Earned today
            </div>
            <div className="inline-flex items-center gap-1 text-base font-bold text-white">
              {claimedTotal}
              <span className="text-[10.5px] font-mono text-[#5A6175]">
                / {totalReward}
              </span>
              <ZapMark className="h-3.5 w-3.5 text-[#FFE600] ml-1" />
            </div>
          </div>
        </header>

        <ul className="divide-y divide-[#20232E]">
          <AnimatePresence initial={false}>
            {rows.map((row) => {
              const def = activeQuests.find((q) => q.kind === row.kind) as ActiveQuest;
              const Icon = ICONS[row.kind] ?? Pencil;
              const pct = (row.progress / row.goal) * 100;
              return (
                <motion.li
                  key={row.kind}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "px-5 py-4 transition-colors",
                    row.claimed && "opacity-50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-[12px] grid place-items-center transition-colors shrink-0",
                        row.completed
                          ? "bg-[#FFE600]/15 text-[#FFE600] border border-[#FFE600]/30"
                          : "bg-[#0E1016] text-[#8B92A8] border border-[#2A2F3D]",
                      )}
                    >
                      {row.claimed ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-white truncate">
                        {def?.title ?? row.kind}
                      </div>
                      <div className="text-[12px] text-[#8B92A8] truncate">
                        {def?.description}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-[11px] font-mono text-[#FFE600] whitespace-nowrap">
                        +{row.reward}⚡
                      </div>
                      {row.completed && !row.claimed && (
                        <button
                          type="button"
                          onClick={() => {
                            const reward = claimQuest(row.kind);
                            if (reward > 0) {
                              toast.success(`+${reward}⚡ claimed`);
                            }
                          }}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#FFE600] text-[#0E1016] hover:scale-[1.03] active:scale-95 transition-transform"
                        >
                          Claim
                        </button>
                      )}
                      {row.claimed && (
                        <span className="text-[10px] font-mono text-[#36D399]">
                          claimed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative flex-1 h-2 rounded-full bg-[#0E1016] overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 240,
                          damping: 30,
                        }}
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          row.claimed
                            ? "bg-[#36D399]"
                            : row.completed
                              ? "bg-gradient-to-r from-[#FFE600] to-[#FFB800]"
                              : "bg-[#4DA3FF]/60",
                        )}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-[#5A6175] whitespace-nowrap">
                      {row.progress}/{row.goal}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {rows.length === 0 && (
            <li className="px-5 py-8 text-center text-[12px] text-[#8B92A8]">
              Loading today&apos;s quests…
            </li>
          )}
        </ul>
        {allClaimed && (
          <div className="px-5 py-3 text-center text-[12px] text-[#36D399] bg-[#36D399]/8 border-t border-[#36D399]/20">
            All quests complete — come back tomorrow for a new set ⚡
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
        <header className="px-5 py-3 border-b border-[#2A2F3D]">
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <ZapIcon className="h-4 w-4 text-[#FFE600]" />
            Recent Zap activity
          </h2>
        </header>
        {ledger.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] text-[#8B92A8]">
            No Zaps earned yet — claim a quest to get started.
          </div>
        ) : (
          <ul className="divide-y divide-[#20232E]">
            {ledger.map((entry) => (
              <li
                key={entry.id}
                className="px-5 py-2.5 flex items-center gap-3"
              >
                <span
                  className={cn(
                    "h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold",
                    entry.delta > 0
                      ? "bg-[#36D399]/15 text-[#36D399]"
                      : "bg-[#FF4757]/15 text-[#FF4757]",
                  )}
                >
                  {entry.delta > 0 ? "+" : "−"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white capitalize">
                    {entry.reason.replace(/_/g, " ")}
                  </div>
                  <div className="text-[10.5px] font-mono text-[#5A6175]">
                    {new Date(entry.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span
                  className={cn(
                    "font-mono text-[12px] tabular-nums",
                    entry.delta > 0 ? "text-[#36D399]" : "text-[#FF4757]",
                  )}
                >
                  {entry.delta > 0 ? "+" : ""}
                  {entry.delta}⚡
                </span>
                <span className="font-mono text-[10.5px] text-[#5A6175] tabular-nums w-12 text-right">
                  {entry.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
