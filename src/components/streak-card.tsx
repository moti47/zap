"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useHydrated, useZapStore } from "@/lib/store";
import { rewardForNextDay } from "@/lib/streaks";
import { toast } from "sonner";
import { Confetti } from "./confetti";

/**
 * Sidebar streak card — compact, motivational, no internal tier math.
 *
 * Per section 25 of the production spec: users should NOT see the
 * tier ladder or composite math. They should see:
 *   - current streak
 *   - next reward (what they'll earn if they show up tomorrow)
 *   - motivational UI
 *
 * The full ladder + analytics still live on `/quests`.
 */
export function StreakCard() {
  const hydrated = useHydrated();
  const streak = useZapStore((s) => s.streak);
  const spendRecovery = useZapStore((s) => s.spendRecovery);
  const touchStreak = useZapStore((s) => s.touchStreak);

  const [burstAt, setBurstAt] = useState(0);
  const lastStreakRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const result = touchStreak();
    // Fire confetti when the streak just extended OR a milestone hit.
    if (result.delta === "extended" || result.delta === "started" || result.milestoneHit) {
      // Defer so the StreakCard finishes painting first.
      setTimeout(() => setBurstAt((n) => n + 1), 100);
    }
  }, [hydrated, touchStreak]);

  // Pop confetti whenever the rendered streak number itself changes
  // (covers external recovery flows + multi-tab).
  useEffect(() => {
    if (!hydrated) return;
    const prev = lastStreakRef.current;
    lastStreakRef.current = streak.currentStreak;
    if (prev !== null && streak.currentStreak > prev) {
      setBurstAt((n) => n + 1);
    }
  }, [streak.currentStreak, hydrated]);

  if (!hydrated) {
    return (
      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] h-[124px]" />
    );
  }

  const current = streak.currentStreak;
  const tomorrow = rewardForNextDay(current);

  const handleRecover = () => {
    if (spendRecovery()) {
      toast.success("Streak recovered ✨", {
        description: "Your streak is safe — keep it alive tomorrow.",
      });
    }
  };

  return (
    <Link
      href="/quests"
      className="group relative block rounded-[14px] border border-[#2A2F3D] bg-gradient-to-br from-[#1A1D26] to-[#14161D] p-4 hover:border-[#FFE600]/30 transition-colors overflow-hidden"
    >
      <Confetti trigger={burstAt} origin="top" />
      <div className="flex items-center gap-3">
        {/* Flame badge */}
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
            rotate: [0, -3, 3, 0],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="h-12 w-12 rounded-[12px] grid place-items-center shrink-0"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, rgba(255,138,61,0.35), transparent 65%)",
            border: "1px solid rgba(255,184,0,0.25)",
          }}
        >
          <Flame
            className="h-6 w-6"
            style={{
              color: current >= 7 ? "#FF4757" : current >= 3 ? "#FFB800" : "#FFE600",
              filter: `drop-shadow(0 0 8px ${current >= 3 ? "#FF6B3D" : "#FFE600"}80)`,
            }}
          />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <motion.span
              key={current}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="text-3xl font-extrabold tabular-nums text-white leading-none"
            >
              {current}
            </motion.span>
            <span className="text-[10px] uppercase tracking-widest text-[#8B92A8]">
              day{current === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-[#8B92A8] leading-tight">
            Show up tomorrow for{" "}
            <span className="text-[#FFE600] font-bold tabular-nums">
              +{tomorrow}⚡
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-[#5A6175] group-hover:text-white shrink-0" />
      </div>

      {streak.pendingRecoveryFor && streak.recoveriesAvailable > 0 && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(e) => {
            e.preventDefault();
            handleRecover();
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md bg-[#FFE600] text-[#0E1016] hover:scale-[1.02] active:scale-95 transition-transform"
        >
          <RefreshCw className="h-3 w-3" /> Recover yesterday&apos;s streak
        </motion.button>
      )}
    </Link>
  );
}
