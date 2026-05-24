"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LivePulseDot } from "./expert-badge";
import { ZapMark } from "./zap-logo";
import { useZapStore } from "@/lib/store";
import { getUser, getMarket } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function LiveTicker({ className }: { className?: string }) {
  const trades = useZapStore((s) => s.recentTrades);
  const [latest, setLatest] = useState<typeof trades[number] | null>(null);

  useEffect(() => {
    if (trades.length === 0) return;
    setLatest(trades[0]);
  }, [trades]);

  if (!latest) return null;
  const user = getUser(latest.userId);
  const market = getMarket(latest.marketId);
  if (!user || !market) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-[#2A2F3D] bg-[#0E1016]/70 backdrop-blur px-3 py-2 flex items-center gap-2 text-[12px] font-mono overflow-hidden",
        className
      )}
    >
      <LivePulseDot />
      <AnimatePresence mode="popLayout">
        <motion.div
          key={latest.id}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="font-semibold text-white truncate">{user.name}</span>
          <span
            className={cn(
              "font-bold",
              latest.side === "YES" ? "text-[#00D982]" : "text-[#FF4757]"
            )}
          >
            {latest.side === "YES" ? "▲" : "▼"} {latest.shares}
          </span>
          <span className="text-[#8B92A8]">@ {latest.price}<ZapMark /></span>
          <span className="text-[#5A6175] truncate max-w-[280px]">
            {market.question}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
