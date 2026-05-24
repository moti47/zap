"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Compass,
  Search as SearchIcon,
  TrendingUp,
  Clock,
  X,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { CategoryTag, LivePulseDot } from "../expert-badge";
import { ZapMark } from "../zap-logo";
import { Sparkline } from "./sparkline";
import { useZapStore, useHydrated } from "@/lib/store";
import {
  markets,
  CATEGORIES,
  type Category,
  type Market,
} from "@/lib/fixtures";
import {
  cn,
  categoryColor,
  formatLargeNumber,
  timeUntil,
} from "@/lib/utils";

type SortKey = "trending" | "newest" | "closing" | "volume";

const SORT_OPTIONS: { id: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "newest", label: "Newest", icon: Compass },
  { id: "closing", label: "Closing Soon", icon: Clock },
  { id: "volume", label: "Volume", icon: TrendingUp },
];

export function MarketsBrowser() {
  const hydrated = useHydrated();
  const livePrices = useZapStore((s) => s.marketPrices);
  const savedIds = useZapStore(useShallow((s) => s.savedMarketIds));

  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortKey>("trending");
  const [search, setSearch] = useState("");

  // Per-category counts
  const counts = useMemo(() => {
    const out: Record<Category, number> = {
      politics: 0,
      crypto: 0,
      sports: 0,
      tech: 0,
      economy: 0,
      entertainment: 0,
    };
    for (const m of markets) out[m.category] += 1;
    return out;
  }, []);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    let list = markets.filter((m) => {
      if (activeCategory !== "all" && m.category !== activeCategory) return false;
      if (lower && !m.question.toLowerCase().includes(lower)) return false;
      return true;
    });
    switch (sort) {
      case "newest":
        list = [...list].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "closing":
        list = [...list].sort(
          (a, b) =>
            new Date(a.resolutionDate).getTime() -
            new Date(b.resolutionDate).getTime()
        );
        break;
      case "volume":
        list = [...list].sort(
          (a, b) =>
            (livePrices[b.id]?.volume ?? b.totalVolume) -
            (livePrices[a.id]?.volume ?? a.totalVolume)
        );
        break;
      default:
        list = [...list].sort((a, b) => b.volume24h - a.volume24h);
    }
    return list;
  }, [activeCategory, sort, search, livePrices]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="h-5 w-5 text-[#FFE600]" />
            <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
          </div>
          <p className="text-sm text-[#8B92A8]">
            Browse every active prediction. Click a card to trade.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
            Active
          </div>
          <div className="text-xl font-bold font-mono tabular-nums">
            {filtered.length.toLocaleString()}
            <span className="text-[#5A6175] text-sm font-normal">
              {" "}/ {markets.length}
            </span>
          </div>
        </div>
      </div>

      {/* Category filter row — full-width sticky chip rail */}
      <div className="sticky top-14 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-[#0A0B0F]/85 backdrop-blur-md border-b border-[#2A2F3D] mb-5">
        <div
          role="tablist"
          aria-label="Filter by category"
          className="flex items-center gap-1.5 overflow-x-auto thin-scrollbar pb-1"
        >
          <CategoryChip
            label="All"
            count={markets.length}
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              count={counts[c]}
              color={categoryColor(c)}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5A6175]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search markets"
            className="w-full pl-9 pr-9 h-10 bg-[#14161D] border border-[#2A2F3D] rounded-md text-sm focus:outline-none focus:border-[#353B4D]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-md text-[#5A6175] hover:text-white hover:bg-[#20232E]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div
          role="tablist"
          aria-label="Sort"
          className="inline-flex p-0.5 rounded-md bg-[#14161D] border border-[#2A2F3D]"
        >
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = sort === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSort(opt.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-[12px] font-medium transition-colors",
                  active
                    ? "bg-[#20232E] text-white shadow-[inset_0_0_0_1px_#353B4D]"
                    : "text-[#8B92A8] hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#2A2F3D] p-12 text-center">
          <div className="text-[#8B92A8] text-sm">
            No markets match{" "}
            {activeCategory !== "all" && (
              <span className="text-white font-semibold capitalize">
                {activeCategory}
              </span>
            )}
            {search && (
              <>
                {" "}with “
                <span className="text-white font-semibold">{search}</span>”
              </>
            )}
            .
          </div>
          <button
            onClick={() => {
              setActiveCategory("all");
              setSearch("");
            }}
            className="mt-3 text-[12px] font-mono text-[#FFE600] hover:underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {filtered.map((m) => (
            <MarketGridCard
              key={m.id}
              market={m}
              saved={savedIds.includes(m.id)}
              hydrated={hydrated}
              livePrice={livePrices[m.id]}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium capitalize transition-all whitespace-nowrap",
        active ? "scale-[1.02]" : "hover:scale-[1.01]"
      )}
      style={{
        borderColor: active ? `${color ?? "#FFE600"}66` : "#2A2F3D",
        color: active ? color ?? "#FFE600" : "#8B92A8",
        background: active ? `${color ?? "#FFE600"}12` : "transparent",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color ?? "#FFE600" }}
      />
      {label}
      <span
        className={cn(
          "font-mono text-[10px]",
          active ? "opacity-80" : "opacity-60"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function MarketGridCard({
  market: m,
  saved,
  hydrated,
  livePrice,
}: {
  market: Market;
  saved: boolean;
  hydrated: boolean;
  livePrice?: { yes: number; no: number; volume: number };
}) {
  const yesPrice = livePrice?.yes ?? m.currentYesPrice;
  const noPrice = livePrice?.no ?? m.currentNoPrice;
  const volume = livePrice?.volume ?? m.totalVolume;
  const color = categoryColor(m.category);
  const closing = hydrated ? timeUntil(m.resolutionDate) : "—";

  return (
    <Link
      href={`/market/${m.id}`}
      className="group relative rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden hover:border-[#353B4D] transition-colors flex flex-col"
    >
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <CategoryTag category={m.category} asLink={false} />
          <span
            suppressHydrationWarning
            className="text-[10.5px] font-mono inline-flex items-center gap-1 text-[#5A6175]"
          >
            <Clock className="h-3 w-3" />
            {closing}
          </span>
        </div>
        <h3 className="font-semibold text-[15px] leading-snug line-clamp-3 group-hover:text-[#FFE600] transition-colors">
          {m.question}
        </h3>
        <div className="flex items-center gap-3">
          <div className="font-mono font-bold inline-flex items-baseline text-[#00D982]">
            <span className="text-[10px] uppercase tracking-widest text-[#5A6175] mr-1">
              YES
            </span>
            {yesPrice}
            <ZapMark />
          </div>
          <div className="font-mono font-bold inline-flex items-baseline text-[#FF4757]">
            <span className="text-[10px] uppercase tracking-widest text-[#5A6175] mr-1">
              NO
            </span>
            {noPrice}
            <ZapMark />
          </div>
          <div className="ml-auto">
            <Sparkline
              data={m.priceHistory.slice(-30)}
              positive={yesPrice >= m.currentYesPrice}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono pt-3 mt-auto border-t border-[#2A2F3D]">
          <span className="text-[#8B92A8] inline-flex items-center gap-1.5">
            <LivePulseDot />
            <span className="text-white font-semibold inline-flex items-center">
              {formatLargeNumber(volume)}
              <ZapMark />
            </span>
            volume
          </span>
          <span className="text-[#8B92A8]">
            <span className="text-white font-semibold">
              {m.traders.toLocaleString()}
            </span>{" "}
            traders
          </span>
        </div>
      </div>
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      {saved && (
        <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-widest text-[#FFE600] bg-[#FFE600]/10 px-1.5 py-0.5 rounded">
          Saved
        </span>
      )}
    </Link>
  );
}
