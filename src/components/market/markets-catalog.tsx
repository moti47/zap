"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Clock, Bookmark, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { CategoryTag } from "../expert-badge";
import { ZapMark } from "../zap-logo";
import { Sparkline } from "./sparkline";
import { useZapStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { markets, CATEGORIES, type Category } from "@/lib/fixtures";
import { cn, categoryColor, formatLargeNumber, timeUntil } from "@/lib/utils";

const HERO_BY_CATEGORY: Record<Category, string[]> = {
  politics: [
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1591189824344-2b5b8f08a5a2?auto=format&fit=crop&w=1200&q=70",
  ],
  crypto: [
    "https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=70",
  ],
  sports: [
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=70",
  ],
  tech: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=70",
  ],
  economy: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=70",
  ],
  entertainment: [
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=70",
  ],
};

function heroFor(id: string, category: Category): string {
  const bucket = HERO_BY_CATEGORY[category];
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return bucket[n % bucket.length];
}

type SortKey = "trending" | "newest" | "closing" | "volume";

export function MarketsCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromComposer = searchParams.get("return") === "composer";

  const savedIds = useZapStore(useShallow((s) => s.savedMarketIds));
  const toggleSave = useZapStore((s) => s.toggleSaveMarket);
  const livePrices = useZapStore((s) => s.marketPrices);

  const [search, setSearch] = useState("");
  const [cats, setCats] = useState<Set<Category>>(new Set());
  const [sort, setSort] = useState<SortKey>("trending");

  const toggleCat = (c: Category) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    let list = markets.filter((m) => {
      if (cats.size > 0 && !cats.has(m.category)) return false;
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
  }, [search, cats, sort, livePrices]);

  const pickMarket = (id: string) => {
    if (fromComposer) {
      router.push(`/feed?attachMarket=${id}`);
      toast.success("Market attached to your post");
    } else {
      router.push(`/market/${id}`);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="h-5 w-5 text-[#FFE600]" />
        <h1 className="text-2xl font-bold tracking-tight">Market catalog</h1>
      </div>
      <p className="text-sm text-[#8B92A8] mb-5">
        {fromComposer
          ? "Pick a market to attach to your post."
          : "Browse, filter, and sort every market on Zap."}
      </p>

      {/* Filters */}
      <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-3 mb-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5A6175]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              aria-label="Search markets"
              className="w-full pl-8 pr-3 h-9 bg-[#14161D] border border-[#2A2F3D] rounded-md text-sm focus:outline-none focus:border-[#353B4D]"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(
              [
                { id: "trending", label: "Trending" },
                { id: "newest", label: "Newest" },
                { id: "closing", label: "Closing Soon" },
                { id: "volume", label: "Volume" },
              ] as { id: SortKey; label: string }[]
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                aria-pressed={sort === s.id}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                  sort === s.id
                    ? "border-[#FFE600]/40 text-[#FFE600] bg-[#FFE600]/8"
                    : "border-[#2A2F3D] text-[#8B92A8] hover:text-white"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => {
            const active = cats.has(c);
            const color = categoryColor(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCat(c)}
                aria-pressed={active}
                className={cn(
                  "h-7 px-2.5 rounded-full border text-xs font-medium capitalize transition-colors flex items-center gap-1.5"
                )}
                style={{
                  borderColor: active ? `${color}66` : "#2A2F3D",
                  color: active ? color : "#8B92A8",
                  background: active ? `${color}10` : "transparent",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {c}
              </button>
            );
          })}
          {cats.size > 0 && (
            <button
              type="button"
              onClick={() => setCats(new Set())}
              className="text-[11px] font-mono text-[#5A6175] hover:text-white ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#2A2F3D] p-10 text-center text-[#8B92A8]">
          No markets match your filters.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const live = livePrices[m.id];
            const yesPrice = live?.yes ?? m.currentYesPrice;
            const noPrice = live?.no ?? m.currentNoPrice;
            const volume = live?.volume ?? m.totalVolume;
            const saved = savedIds.includes(m.id);
            return (
              <motion.div
                key={m.id}
                layout
                role="button"
                tabIndex={0}
                onClick={() => pickMarket(m.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pickMarket(m.id);
                  }
                }}
                className="cursor-pointer text-left rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden hover:border-[#353B4D] focus:outline-none focus:ring-2 focus:ring-[#FFE600]/50 transition-colors flex flex-col"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroFor(m.id, m.category)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(0deg, rgba(26,29,38,0.95) 5%, rgba(26,29,38,0.2) 60%, transparent), linear-gradient(90deg, ${categoryColor(m.category)}55, transparent 60%)`,
                    }}
                  />
                  <div className="absolute top-2 left-2">
                    <CategoryTag category={m.category} asLink={false} />
                  </div>
                  <button
                    type="button"
                    aria-label={saved ? "Remove from saved" : "Save market"}
                    aria-pressed={saved}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSave(m.id);
                      toast.success(saved ? "Removed from saved" : "Market saved");
                    }}
                    className={cn(
                      "absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-colors",
                      saved ? "text-[#FFE600]" : "text-white"
                    )}
                  >
                    <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-[#FFE600]")} />
                  </button>
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <h3 className="font-semibold text-[14px] leading-snug line-clamp-2">
                    {m.question}
                  </h3>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="font-mono font-bold text-[#00D982] inline-flex items-center">
                      YES&nbsp;{yesPrice}<ZapMark />
                    </div>
                    <div className="font-mono font-bold text-[#FF4757] inline-flex items-center">
                      NO&nbsp;{noPrice}<ZapMark />
                    </div>
                    <div className="ml-auto">
                      <Sparkline data={m.priceHistory.slice(-30)} positive={yesPrice >= m.currentYesPrice} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#8B92A8] mt-auto">
                    <span className="inline-flex items-center">
                      {formatLargeNumber(volume)}<ZapMark />
                    </span>
                    <span className="text-[#5A6175]">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeUntil(m.resolutionDate)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {fromComposer && (
        <div className="mt-6 text-center">
          <Link
            href="/feed"
            className="text-sm font-mono text-[#8B92A8] hover:text-white"
          >
            ← Back to composer
          </Link>
        </div>
      )}
    </div>
  );
}
