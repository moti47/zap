"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Trophy, Medal } from "lucide-react";
import { UserAvatar } from "../user-avatar";
import { ExpertBadge } from "../expert-badge";
import { ZapMark } from "../zap-logo";
import type { User } from "@/lib/mock-data";
import { formatLargeNumber } from "@/lib/utils";

interface PodiumProps {
  ranking: { user: User; score: number }[];
  category: string;
}

export function Podium({ ranking, category }: PodiumProps) {
  const [first, second, third] = ranking;

  if (!first) return null;

  return (
    <div className="mt-6">
      <div className="hidden md:grid md:grid-cols-3 items-end gap-4">
        {second && <PodiumCard rank={2} entry={second} category={category} />}
        <PodiumCard rank={1} entry={first} category={category} />
        {third && <PodiumCard rank={3} entry={third} category={category} />}
      </div>
      {/* Mobile stacked podium */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {[first, second, third].filter(Boolean).map((entry, i) => (
          <PodiumCard
            key={entry.user.id}
            rank={i + 1}
            entry={entry}
            category={category}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function PodiumCard({
  rank,
  entry,
  category,
  compact = false,
}: {
  rank: number;
  entry: { user: User; score: number };
  category: string;
  compact?: boolean;
}) {
  const { user, score } = entry;
  const colors = {
    1: { primary: "#FFB800", border: "#FFB800", glow: "rgba(255, 184, 0, 0.18)" },
    2: { primary: "#C8CDDA", border: "#5A6175", glow: "rgba(200, 205, 218, 0.10)" },
    3: { primary: "#B87333", border: "#80502C", glow: "rgba(184, 115, 51, 0.12)" },
  }[rank as 1 | 2 | 3];

  const icon = rank === 1 ? Crown : rank === 2 ? Trophy : Medal;
  const Icon = icon;

  const height = compact ? "h-auto" : rank === 1 ? "h-[240px]" : rank === 2 ? "h-[200px]" : "h-[180px]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      className={`relative ${height}`}
    >
      <Link
        href={`/profile/${user.username}`}
        className="block h-full rounded-[14px] border-2 p-4 relative overflow-hidden group hover:brightness-110 transition-all"
        style={{
          borderColor: colors!.border,
          background: `linear-gradient(180deg, ${colors!.glow}, #1A1D26 60%)`,
        }}
      >
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full opacity-30 blur-2xl pointer-events-none"
          style={{ background: colors!.primary }}
        />
        <div className="flex flex-col items-center relative">
          <div
            className="absolute -top-3 -left-3 h-9 w-9 rounded-full flex items-center justify-center font-bold font-mono"
            style={{ background: colors!.primary, color: "#0A0B0F" }}
          >
            {rank}
          </div>
          <Icon
            className="h-6 w-6 mb-2"
            style={{ color: colors!.primary, fill: rank === 1 ? colors!.primary : "transparent" }}
          />
          <UserAvatar
            src={user.avatarUrl}
            name={user.name}
            category={user.primaryCategory}
            size={rank === 1 ? "lg" : "md"}
            showScore={false}
          />
          <div className="mt-3 text-center">
            <div className="font-bold text-base">{user.name}</div>
            <div className="text-[11px] font-mono text-[#5A6175]">@{user.username}</div>
          </div>
          <div
            className="mt-3 text-4xl font-bold font-mono tabular-nums"
            style={{ color: colors!.primary }}
          >
            {Math.round(score)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
            {category} Score
          </div>
          <div className="mt-2 text-[11px] font-mono text-[#8B92A8] inline-flex items-center gap-1">
            {formatLargeNumber(user.pointsWon)}
            <ZapMark />
            won · {user.totalPredictions} predictions
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
