"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "for-you", label: "For You", count: null },
  { id: "following", label: "Following", count: 28 },
  { id: "predictions", label: "Predictions", count: 142 },
  { id: "markets", label: "Markets", count: 38 },
];

export function FeedTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded-md bg-[#14161D] border border-[#2A2F3D] overflow-x-auto no-scrollbar">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors whitespace-nowrap",
              active
                ? "text-white"
                : "text-[#8B92A8] hover:text-white"
            )}
          >
            {active && (
              <motion.span
                layoutId="feed-tab-active"
                className="absolute inset-0 rounded-sm bg-[#20232E] border border-[#353B4D]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
            {t.count !== null && (
              <span className="relative z-10 font-mono text-[10px] text-[#5A6175]">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
