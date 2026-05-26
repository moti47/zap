"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  EMPTY_METRICS,
  composite,
  tierFor,
  type ReputationMetrics,
  type ResolutionStats,
  type TierDef,
  METRIC_KEYS,
  METRIC_LABELS,
  METRIC_WEIGHTS,
} from "@/lib/reputation";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";

interface ReputationTierProps {
  metrics?: Partial<ReputationMetrics>;
  stats?: ResolutionStats;
  category?: string;
  size?: "sm" | "md";
  /** Show "View breakdown" popover trigger. */
  interactive?: boolean;
}

export function ReputationTier({
  metrics,
  stats = { resolved: 0, volume: 0 },
  category,
  size = "sm",
  interactive = true,
}: ReputationTierProps) {
  const filled: ReputationMetrics = { ...EMPTY_METRICS, ...metrics };
  const c = composite(filled);
  const tier = tierFor(filled, stats);

  const Body = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-widest",
        size === "sm" ? "h-5 px-1.5 text-[9px]" : "h-7 px-2.5 text-[10px]",
      )}
      style={{
        color: tier.color,
        borderColor: `${tier.color}55`,
        background: `${tier.color}10`,
        boxShadow: tier.glow !== "transparent" ? `0 0 14px ${tier.glow}` : undefined,
      }}
    >
      <Sparkles className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
      {tier.label}
    </span>
  );

  if (!interactive) return Body;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="focus:outline-none">
          {Body}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 overflow-hidden">
        <header className="px-4 py-3 border-b border-[#2A2F3D] flex items-center justify-between bg-gradient-to-br from-[#1A1D26] to-[#14161D]">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#5A6175]">
              Expertise{category ? ` · ${category}` : ""}
            </div>
            <div className="text-sm font-bold mt-0.5" style={{ color: tier.color }}>
              {tier.label}
            </div>
          </div>
          <div className="text-right text-[10px] font-mono text-[#8B92A8]">
            <div>
              composite{" "}
              <span style={{ color: tier.color }}>{c.toFixed(2)}</span>
            </div>
            <div className="mt-0.5">vol {stats.volume.toLocaleString()}⚡</div>
          </div>
        </header>
        <ul className="p-3 space-y-2 text-[11px]">
          {METRIC_KEYS.map((k) => {
            const v = filled[k];
            return (
              <li key={k}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white">{METRIC_LABELS[k]}</span>
                  <span className="font-mono text-[10px] text-[#8B92A8]">
                    {(v * 100).toFixed(0)}%{" "}
                    <span className="text-[#5A6175]">
                      ×{METRIC_WEIGHTS[k].toFixed(2)}
                    </span>
                  </span>
                </div>
                <div className="relative h-1 rounded-full bg-[#0E1016] overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${Math.round(v * 100)}%` }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: tier.color, opacity: 0.85 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <footer className="px-4 py-2 border-t border-[#2A2F3D] text-[10px] font-mono text-[#5A6175]">
          Tiers: New → Emerging → Skilled → Expert → Elite → Oracle
        </footer>
      </PopoverContent>
    </Popover>
  );
}

export type { TierDef };
