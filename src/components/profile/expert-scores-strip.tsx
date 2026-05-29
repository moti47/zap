"use client";

import { motion } from "framer-motion";
import {
  Vote,
  Bitcoin,
  Trophy,
  Cpu,
  LineChart,
  Music,
  Sparkles,
  Brain,
  Globe,
  Leaf,
  Atom,
  Film,
  Gamepad2,
  Newspaper,
  TrendingUp,
  Microscope,
  type LucideIcon,
} from "lucide-react";
import { CATEGORIES, type User } from "@/lib/fixtures";
import { Sparkline } from "../market/sparkline";

/**
 * Per-category visual identity used by the Expert Scores strip.
 *
 * Both icon AND colorway live in the same record so the card stays
 * visually coherent: the icon, score number, ring stroke, sparkline,
 * and accent border all draw from one source of truth.
 *
 * IMPORTANT: `Category` is widened to `string` in our type system
 * (categories are user-extensible), so an explicit FALLBACK entry is
 * REQUIRED. Without one, looking up an unmapped slug would resolve
 * to `undefined` and rendering `<undefined/>` would throw React's
 * "Element type is invalid: expected a string... but got: undefined"
 * error and take down the whole profile page.
 */
interface CategoryStyle {
  icon: LucideIcon;
  color: string;
}

const STYLE_MAP: Record<string, CategoryStyle> = {
  politics: { icon: Vote, color: "#A371F7" },          // Purple
  crypto: { icon: Bitcoin, color: "#FF8A3D" },         // Orange
  sports: { icon: Trophy, color: "#36D399" },          // Emerald
  tech: { icon: Cpu, color: "#22D3EE" },               // Cyan
  economy: { icon: LineChart, color: "#F7768E" },      // Rose
  entertainment: { icon: Music, color: "#FF6FB5" },    // Pink
  ai: { icon: Brain, color: "#8B5CF6" },               // Violet
  stocks: { icon: TrendingUp, color: "#10B981" },      // Emerald (deeper)
  finance: { icon: LineChart, color: "#34D399" },      // Mint
  geopolitics: { icon: Globe, color: "#6366F1" },      // Indigo
  climate: { icon: Leaf, color: "#14B8A6" },           // Teal
  science: { icon: Atom, color: "#38BDF8" },           // Sky
  health: { icon: Microscope, color: "#FB7185" },      // Pink-red
  movies: { icon: Film, color: "#FF6FB5" },            // Pink
  tv: { icon: Film, color: "#F472B6" },                // Light pink
  gaming: { icon: Gamepad2, color: "#A371F7" },        // Purple
  esports: { icon: Gamepad2, color: "#C084FC" },       // Lilac
  elections: { icon: Vote, color: "#FB923C" },         // Tangerine
  music: { icon: Music, color: "#FF6FB5" },            // Pink
};

const FALLBACK_STYLE: CategoryStyle = {
  icon: Sparkles,
  color: "#FFE600",
};

function styleFor(category: string): CategoryStyle {
  return STYLE_MAP[category] ?? FALLBACK_STYLE;
}

const TOP_N = 10;

interface ExpertScoresStripProps {
  user: User;
}

export function ExpertScoresStrip({ user }: ExpertScoresStripProps) {
  // Build the per-category dataset, then sort by score DESC and slice
  // to the user's top N specialties. This keeps the strip focused on
  // the categories where the user is actually strong, instead of
  // dumping all 49 supported slugs onto the page.
  const ranked = CATEGORIES
    .map((cat) => {
      const score = user.expertScores[cat] ?? 50;
      const brier = user.brierScores[cat] ?? 0.25;
      const count = user.predictionsByCategory[cat] ?? 0;
      return { cat, score, brier, count };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold">
          Expert Scores · <span className="text-[#8B92A8] font-normal">Top {TOP_N}</span>
        </h3>
        <span className="text-[11px] font-mono text-[#5A6175]">
          Percentile across {user.totalPredictions.toLocaleString()} predictions
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {ranked.map(({ cat, score, brier, count }) => {
          const { icon: Icon, color } = styleFor(cat);
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

interface ScoreCardProps {
  category: string;
  score: number;
  brier: number;
  count: number;
  color: string;
  isTopPerformer: boolean;
  Icon: LucideIcon;
}

function ScoreCard({
  category,
  score,
  brier,
  count,
  color,
  isTopPerformer,
  Icon,
}: ScoreCardProps) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  // Deterministic sparkline shape tied to the score so the wave reads
  // "this category is doing well" without a separate data source.
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
        {/* Sparkline inherits the category color so the wave reads as the
            same visual unit as the icon, ring, and score. */}
        <Sparkline
          data={trend}
          color={color}
          width={140}
          height={28}
        />
      </div>
    </motion.div>
  );
}
