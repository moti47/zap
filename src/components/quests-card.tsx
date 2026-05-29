"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "./confetti";
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
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useHydrated, useZapStore } from "@/lib/store";
import { useViewer } from "@/lib/use-viewer";
import {
  questProgressFromCounts,
  type ActiveQuest,
  type QuestKind,
} from "@/lib/quests";
import { ZapMark } from "./zap-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { claimQuestAction } from "@/app/quests/actions";

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

export function QuestsCard() {
  const hydrated = useHydrated();
  const ensureDailyQuests = useZapStore((s) => s.ensureDailyQuests);
  const activeQuests = useZapStore(useShallow((s) => s.activeQuests));
  const counts = useZapStore((s) => s.questCounts);
  const claimed = useZapStore((s) => s.questClaimed);
  const claimQuest = useZapStore((s) => s.claimQuest);
  const { viewer } = useViewer();
  const [burstAt, setBurstAt] = useState(0);

  useEffect(() => {
    if (hydrated) ensureDailyQuests();
  }, [hydrated, ensureDailyQuests]);

  const rows = useMemo(
    () => questProgressFromCounts(activeQuests, counts, claimed),
    [activeQuests, counts, claimed],
  );

  const totalReward = activeQuests.reduce((s, q) => s + q.reward, 0);
  const claimedTotal = rows
    .filter((r) => r.claimed)
    .reduce((s, r) => s + r.reward, 0);
  const claimableNow = rows.filter((r) => r.completed && !r.claimed).length;

  if (!hydrated) {
    return (
      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] h-[260px]" />
    );
  }

  return (
    <section className="relative rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26]">
      <Confetti trigger={burstAt} origin="top" />
      <Link
        href="/quests"
        className="group flex items-center justify-between px-4 py-3 border-b border-[#2A2F3D] bg-gradient-to-br from-[#FFE600]/8 to-transparent hover:from-[#FFE600]/12 transition-colors rounded-t-[14px]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ZapMark className="h-4 w-4 text-[#FFE600] shrink-0" />
          <h3 className="text-sm font-semibold text-white truncate">
            Daily quests
          </h3>
          {claimableNow > 0 && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#FFE600] text-[#0A0B0F]"
            >
              {claimableNow} ready
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-[#8B92A8] tabular-nums">
            {claimedTotal}/{totalReward}⚡
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-[#5A6175] group-hover:text-white" />
        </div>
      </Link>
      <ul className="divide-y divide-[#20232E]">
        <AnimatePresence initial={false}>
          {rows.map((row) => {
            const def = activeQuests.find((q) => q.kind === row.kind) as ActiveQuest;
            const Icon = ICONS[row.kind] ?? Pencil;
            const pct = (row.progress / row.goal) * 100;
            return (
              <motion.li
                key={row.kind}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "px-3.5 py-2.5 transition-colors",
                  row.claimed && "opacity-50",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full grid place-items-center transition-colors shrink-0",
                      row.completed
                        ? "bg-[#FFE600]/15 text-[#FFE600]"
                        : "bg-[#0E1016] text-[#8B92A8]",
                    )}
                  >
                    {row.claimed ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-white truncate leading-tight">
                      {def?.title ?? row.kind}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="relative flex-1 h-1 rounded-full bg-[#0E1016] overflow-hidden">
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
                      <span className="text-[9.5px] font-mono text-[#5A6175] whitespace-nowrap">
                        {row.progress}/{row.goal}
                      </span>
                    </div>
                  </div>
                  {row.completed && !row.claimed ? (
                    <motion.button
                      type="button"
                      onClick={async () => {
                        // Local optimistic claim first — UI bumps
                        // immediately, the row collapses into the
                        // claimed state.
                        const reward = claimQuest(row.kind);
                        if (reward > 0) {
                          setBurstAt((n) => n + 1);
                          toast.success(`+${reward}⚡ claimed`);
                        }
                        // Server claim — credits real `profiles.zaps`
                        // when signed in. The local claim above is a
                        // demo no-op for the offline fixture flow.
                        if (viewer) {
                          const def = activeQuests.find((q) => q.kind === row.kind);
                          if (!def) return;
                          const result = await claimQuestAction({
                            kind: row.kind,
                            goal: def.goal,
                            reward: def.reward,
                          });
                          if (!result.ok) {
                            // Reasons like "incomplete" or "day_rolled"
                            // mean the server disagreed — soft-warn
                            // instead of failing loudly.
                            if (result.error === "already_claimed") return;
                            toast.info("Quest claim couldn't post — try again later", {
                              description: result.error,
                            });
                          }
                        }
                      }}
                      whileTap={{ scale: 0.92 }}
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(255,230,0,0.0)",
                          "0 0 14px 2px rgba(255,230,0,0.45)",
                          "0 0 0 0 rgba(255,230,0,0.0)",
                        ],
                      }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#FFE600] text-[#0E1016] hover:scale-[1.04] transition-transform shrink-0"
                    >
                      +{row.reward}
                    </motion.button>
                  ) : (
                    <span className="text-[10px] font-mono text-[#FFE600] whitespace-nowrap shrink-0">
                      +{row.reward}⚡
                    </span>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {rows.length === 0 && (
          <li className="px-3.5 py-5 text-center text-[11px] text-[#8B92A8]">
            Loading today&apos;s quests…
          </li>
        )}
      </ul>
    </section>
  );
}
