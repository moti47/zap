"use client";

import { ChevronRight } from "lucide-react";
import { useZapStore } from "@/lib/store";
import { NEUTRAL_AFFINITY } from "@/lib/affinity";
import { cn, categoryColor } from "@/lib/utils";

const CAT_ICONS: Record<string, string> = {
  politics: "🏛️", crypto: "🔗", sports: "🏆", tech: "⚡", economy: "📈",
  entertainment: "🎬", ai: "🤖", stocks: "📊", finance: "💵", elections: "🗳️",
  geopolitics: "🌍", climate: "🌡️", science: "🔬", health: "🩺", gaming: "🎮",
  movies: "🎥", music: "🎵", war: "⚔️", space: "🚀", soccer: "⚽",
  nba: "🏀", nfl: "🏈", f1: "🏎️", ufc: "🥋", startups: "🚀", vc: "💼",
};

const DEFAULT_CATS = ["crypto", "tech", "politics", "sports", "economy", "ai"];

interface FeedFilterChipsProps {
  value: string;
  onChange: (cat: string) => void;
  onOpenPicker: () => void;
}

export function FeedFilterChips({ value, onChange, onOpenPicker }: FeedFilterChipsProps) {
  const graph = useZapStore((s) => s.affinityGraph);
  const applySignal = useZapStore((s) => s.applySignal);

  // Sort categories by affinity, take top 8
  const affinityCats = Object.entries(graph.categories)
    .filter(([, v]) => v > NEUTRAL_AFFINITY)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([slug, score]) => ({ slug, score }));

  const displayCats =
    affinityCats.length >= 3
      ? affinityCats
      : DEFAULT_CATS.map((slug) => ({ slug, score: NEUTRAL_AFFINITY }));

  function handleChip(slug: string) {
    const next = slug === value ? "" : slug;
    onChange(next);
    if (next) {
      applySignal("click_category", { category: next });
    }
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" data-feed-filter-chips>
      {/* All */}
      <Chip
        active={value === ""}
        color="#FFE600"
        onClick={() => onChange("")}
      >
        All
      </Chip>

      {displayCats.map(({ slug, score }) => {
        const icon = CAT_ICONS[slug] ?? "🏷️";
        const active = value === slug;
        const color = categoryColor(slug);
        const barW = Math.max(6, Math.round((score - NEUTRAL_AFFINITY) / (1 - NEUTRAL_AFFINITY) * 20));

        return (
          <Chip key={slug} active={active} color={color} onClick={() => handleChip(slug)}>
            <span aria-hidden>{icon}</span>
            <span>{slug}</span>
            {score > NEUTRAL_AFFINITY + 0.08 && (
              <span
                aria-hidden
                className="inline-block h-1 rounded-full opacity-70 shrink-0"
                style={{ width: barW, background: active ? color : "#353B4D" }}
              />
            )}
          </Chip>
        );
      })}

      {/* More → opens category picker */}
      <button
        type="button"
        onClick={onOpenPicker}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed",
          "border-[#2A2F3D] text-[11px] font-mono text-[#5A6175]",
          "hover:border-[#4A5168] hover:text-white transition-colors shrink-0 whitespace-nowrap",
        )}
      >
        More
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11.5px] font-mono shrink-0 whitespace-nowrap transition-all"
      style={{
        borderColor: active ? color : "#2A2F3D",
        color: active ? color : "#8B92A8",
        background: active ? `${color}14` : undefined,
        boxShadow: active ? `0 0 0 1px ${color}30` : undefined,
      }}
    >
      {children}
    </button>
  );
}
