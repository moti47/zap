"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserAvatar } from "../user-avatar";
import { ExpertBadge, CategoryTag, LivePulseDot } from "../expert-badge";
import { ZapMark } from "../zap-logo";
import { users, markets } from "@/lib/fixtures";
import { categoryColor } from "@/lib/utils";

export function AmbientFeed() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1800);
    return () => clearInterval(i);
  }, []);

  const market = markets[0];
  const yes = 38 + (tick % 5);
  const no = 100 - yes;

  return (
    <div className="relative rounded-[18px] border border-[#2A2F3D] bg-gradient-to-b from-[#15171F] to-[#0E1016] overflow-hidden">
      {/* Glow */}
      <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-[#FFE600]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-32 w-[400px] h-[400px] rounded-full bg-[#00D982]/8 blur-3xl pointer-events-none" />

      <div className="relative p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
            Live on Zap
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#FFE600] uppercase tracking-widest">
            <LivePulseDot /> {tick % 9 + 12} traders in this market
          </span>
        </div>

        {/* Big market card */}
        <motion.div
          animate={{ borderColor: ["#2A2F3D", "#353B4D", "#2A2F3D"] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="rounded-md border bg-[#0E1016] p-4"
        >
          <CategoryTag category={market.category} asLink={false} />
          <div className="mt-1 font-semibold text-[15px] leading-tight">
            {market.question}
          </div>
          <div className="mt-3 flex items-center gap-6">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#5A6175]">
                YES
              </div>
              <motion.div
                key={yes}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold font-mono text-[#00D982] tabular-nums inline-flex items-center"
              >
                {yes}
                <ZapMark className="lg" />
              </motion.div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#5A6175]">
                NO
              </div>
              <motion.div
                key={no}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold font-mono text-[#FF4757] tabular-nums inline-flex items-center"
              >
                {no}
                <ZapMark className="lg" />
              </motion.div>
            </div>
            <div className="ml-auto flex flex-col items-end">
              <span
                key={`d-${tick}`}
                className="px-2 py-1 rounded font-mono text-[10px] bg-[#00D982]/10 text-[#00D982]"
              >
                ▲ {((yes - 38) || 0.5).toFixed(1)}% in last 5m
              </span>
            </div>
          </div>
        </motion.div>

        {/* Live trades scrolling */}
        <div className="space-y-1.5 overflow-hidden h-[160px]">
          {users.slice(0, 6).map((u, i) => (
            <motion.div
              key={`${tick}-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 text-[12px]"
            >
              <UserAvatar
                src={u.avatarUrl}
                name={u.name}
                size="xs"
                category={u.primaryCategory}
                showScore={false}
              />
              <span className="font-medium truncate">{u.name}</span>
              <span
                className={`font-mono font-bold ${
                  i % 2 === 0 ? "text-[#00D982]" : "text-[#FF4757]"
                }`}
              >
                {i % 2 === 0 ? "▲" : "▼"} {(60 + i * 30) * 2}
              </span>
              <span className="font-mono text-[#5A6175] text-[11px]">
                @ {30 + i * 3}¢
              </span>
              <span className="ml-auto font-mono text-[10px] text-[#5A6175]">
                {i + 2}s
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
