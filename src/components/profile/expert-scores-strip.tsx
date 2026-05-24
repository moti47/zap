"use client";

import { motion } from "framer-motion";
import {
  Vote,
  Bitcoin,
  Trophy,
  Cpu,
  LineChart,
  Music,
  TrendingUp,
} from "lucide-react";
import { CATEGORIES, type Category, type User } from "@/lib/mock-data";
import { categoryColor } from "@/lib/utils";
import { Sparkline } from "../market/sparkline";

const iconMap: Record<Category, any> = {
  politics: Vote,
  crypto: Bitcoin,
  sports: Trophy,
  tech: Cpu,
  economy: LineChart,
  entertainment: Music,
};

interface ExpertScoresStripProps {
  user: User;
}

export function ExpertScoresStrip({ user }: ExpertScoresStripProps) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold">Expert Scores</h3>
        <span className="text-[11px] font-mono text-[#5A6175]">
          Percentile across {user.totalPredictions.toLocaleString()} predictions
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {CATEGORIES.map((cat) => {
          const score = user.expertScores[cat] ?? 50;
          const brier = user.brierScores[cat] ?? 0.25;
          const count = user.predictionsByCategory[cat] ?? 0;
          const Icon = iconMap[cat];
          const color = categoryColor(cat);
          const isTopPerformer = score >= 90;

          return (
            <ScoreCard
              key={cat}
              category={cat}
              score={score}
              brier={brier}
              count={count}
              color={color}
              isTopPerformer={isTopPerformer}
              Icon={Icon}
            />
          );
        })}
      </div>
    </div>
  );
}

function ScoreCard({
  category,
  score,
  brier,
  count,
  color,
  isTopPerformer,
  Icon,
}: {
  category: string;
  score: number;
  brier: number;
  count: number;
  color: string;
  isTopPerformer: boolean;
  Icon: any;
}) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  // generate fake sparkline data based on score
  const trend = Array.from({ length: 14 }, (_, i) => ({
    yesPrice: score + (Math.sin(i * 0.7) * 6) + (i / 14 - 0.5) * (score > 60 ? 4 : -2),
  }));

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-[14px] border p-4 relative overflow-hidden"
      style={{
        background: isTopPerformer
          ? `linear-gradient(135deg, ${color}1A, #1A1D26 70%)`
          : "#1A1D26",
        borderColor: isTopPerformer ? `${color}55` : "#2A2F3D",
      }}
    >
      {isTopPerformer && (
        <div
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-30 blur-2xl pointer-events-none"
          style={{ background: color }}
        />
      )}
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#8B92A8] flex items-center gap-1.5">
            <Icon className="h-3 w-3" style={{ color }} /> {category}
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tabular-nums font-mono mt-1"
            style={{ color }}
          >
            {score}
          </motion.div>
          <div className="text-[10px] font-mono text-[#5A6175]">
            {count} preds · {brier.toFixed(3)} Brier
          </div>
        </div>
        <svg width="60" height="60" className="relative">
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="#2A2F3D"
            strokeWidth="3"
          />
          <motion.circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            strokeLinecap="round"
            transform="rotate(-90 30 30)"
          />
        </svg>
      </div>
      <div className="mt-2">
        <Sparkline data={trend} positive={score > 55} width={140} height={28} />
      </div>
    </motion.div>
  );
}
