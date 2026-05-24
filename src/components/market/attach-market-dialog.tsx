"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Clock, ArrowLeft, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
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

interface AttachMarketDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fires only after the user clicks the explicit Confirm button. */
  onConfirm: (marketId: string) => void;
}

/**
 * Two-step modal for attaching a market to a draft post:
 *   1) browse — grid of market cards with category chips, search, sort.
 *   2) confirm — preview of the picked market with explicit "Attach" /
 *      "Cancel" buttons. We NEVER call onConfirm from step 1.
 */
export function AttachMarketDialog({
  open,
  onOpenChange,
  onConfirm,
}: AttachMarketDialogProps) {
  const livePrices = useZapStore((s) => s.marketPrices);
  const hydrated = useHydrated();

  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("trending");
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      setActiveCategory("all");
      setSearch("");
      setSort("trending");
      setPendingId(null);
    }
  }, [open]);

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
  }, [activeCategory, search, sort, livePrices]);

  const pending = pendingId ? markets.find((m) => m.id === pendingId) ?? null : null;

  const handleConfirm = () => {
    if (!pending) return;
    onConfirm(pending.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-[#0E1016] border-[#2A2F3D]">
        {pending ? (
          // === Step 2: CONFIRM ===
          <>
            <DialogHeader className="px-5 py-4 border-b border-[#2A2F3D]">
              <DialogTitle className="text-base font-semibold inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingId(null)}
                  aria-label="Back to catalog"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#2A2F3D] text-[#8B92A8] hover:text-white hover:border-[#353B4D]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                Attach this question?
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[#8B92A8]">
                Preview the market below — nothing is posted yet.
              </DialogDescription>
            </DialogHeader>
            <div className="p-5">
              <MarketPreview market={pending} hydrated={hydrated} live={livePrices[pending.id]} />
              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPendingId(null)}
                  className="text-[#8B92A8]"
                >
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button variant="default" onClick={handleConfirm}>
                  <Check className="h-4 w-4" /> Attach to post
                </Button>
              </div>
              <p className="mt-3 text-[11px] font-mono text-center text-[#5A6175]">
                You can still keep typing and tweak your post before publishing.
              </p>
            </div>
          </>
        ) : (
          // === Step 1: BROWSE ===
          <>
            <DialogHeader className="px-5 py-4 border-b border-[#2A2F3D]">
              <DialogTitle className="text-base font-semibold">
                Attach a question
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[#8B92A8]">
                Pick a market to embed in your post. You&apos;ll confirm before it
                attaches.
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5A6175]" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions…"
                  aria-label="Search markets"
                  className="w-full pl-9 pr-3 h-10 bg-[#14161D] border border-[#2A2F3D] rounded-md text-sm focus:outline-none focus:border-[#353B4D]"
                />
              </div>
              <div
                role="tablist"
                aria-label="Filter by category"
                className="flex items-center gap-1.5 overflow-x-auto thin-scrollbar mt-3 pb-1"
              >
                <ChipButton
                  active={activeCategory === "all"}
                  onClick={() => setActiveCategory("all")}
                  label="All"
                />
                {CATEGORIES.map((c) => (
                  <ChipButton
                    key={c}
                    active={activeCategory === c}
                    onClick={() => setActiveCategory(c)}
                    label={c}
                    color={categoryColor(c)}
                  />
                ))}
                <div className="flex-1" />
                <SortPicker sort={sort} setSort={setSort} />
              </div>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto thin-scrollbar">
              {filtered.length === 0 ? (
                <div className="text-center text-sm text-[#8B92A8] py-10">
                  No markets match your filters.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {filtered.map((m) => (
                    <CatalogCard
                      key={m.id}
                      market={m}
                      hydrated={hydrated}
                      live={livePrices[m.id]}
                      onPick={() => setPendingId(m.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChipButton({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-medium capitalize whitespace-nowrap transition-colors"
      )}
      style={{
        borderColor: active ? `${color ?? "#FFE600"}66` : "#2A2F3D",
        color: active ? color ?? "#FFE600" : "#8B92A8",
        background: active ? `${color ?? "#FFE600"}12` : "transparent",
      }}
    >
      {color !== undefined && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </button>
  );
}

function SortPicker({
  sort,
  setSort,
}: {
  sort: SortKey;
  setSort: (s: SortKey) => void;
}) {
  return (
    <div className="inline-flex p-0.5 rounded-md bg-[#14161D] border border-[#2A2F3D]">
      {(
        [
          { id: "trending", label: "Trending" },
          { id: "newest", label: "Newest" },
          { id: "closing", label: "Closing" },
          { id: "volume", label: "Volume" },
        ] as { id: SortKey; label: string }[]
      ).map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSort(s.id)}
          aria-pressed={sort === s.id}
          className={cn(
            "px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors",
            sort === s.id
              ? "bg-[#20232E] text-white shadow-[inset_0_0_0_1px_#353B4D]"
              : "text-[#5A6175] hover:text-white"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function CatalogCard({
  market: m,
  hydrated,
  live,
  onPick,
}: {
  market: Market;
  hydrated: boolean;
  live?: { yes: number; no: number; volume: number };
  onPick: () => void;
}) {
  const yesPrice = live?.yes ?? m.currentYesPrice;
  const noPrice = live?.no ?? m.currentNoPrice;
  const volume = live?.volume ?? m.totalVolume;
  const closing = hydrated ? timeUntil(m.resolutionDate) : "—";
  return (
    <motion.button
      layout
      type="button"
      onClick={onPick}
      className="text-left p-3 rounded-md border border-[#2A2F3D] bg-[#14161D] hover:border-[#FFE600]/40 hover:bg-[#FFE600]/5 transition-colors flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-[#FFE600]/50"
    >
      <div className="flex items-center justify-between gap-2">
        <CategoryTag category={m.category} asLink={false} />
        <span
          suppressHydrationWarning
          className="text-[10px] font-mono inline-flex items-center gap-1 text-[#5A6175]"
        >
          <Clock className="h-3 w-3" />
          {closing}
        </span>
      </div>
      <div className="font-semibold text-[13.5px] leading-snug line-clamp-2">
        {m.question}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-[#00D982] inline-flex items-center">
          YES {yesPrice}
          <ZapMark />
        </span>
        <span className="font-mono text-[11px] font-bold text-[#FF4757] inline-flex items-center">
          NO {noPrice}
          <ZapMark />
        </span>
        <div className="ml-auto">
          <Sparkline
            data={m.priceHistory.slice(-30)}
            positive={yesPrice >= m.currentYesPrice}
          />
        </div>
      </div>
      <div className="text-[10.5px] font-mono text-[#8B92A8] inline-flex items-center gap-1.5">
        <LivePulseDot />
        {formatLargeNumber(volume)}
        <ZapMark />
        {" · "}
        {m.traders.toLocaleString()} traders
      </div>
    </motion.button>
  );
}

function MarketPreview({
  market: m,
  hydrated,
  live,
}: {
  market: Market;
  hydrated: boolean;
  live?: { yes: number; no: number; volume: number };
}) {
  const yesPrice = live?.yes ?? m.currentYesPrice;
  const noPrice = live?.no ?? m.currentNoPrice;
  const volume = live?.volume ?? m.totalVolume;
  const color = categoryColor(m.category);
  const closing = hydrated ? timeUntil(m.resolutionDate) : "—";
  return (
    <div
      className="rounded-md border bg-[#14161D] p-4 flex flex-col gap-3"
      style={{ borderColor: `${color}44` }}
    >
      <div className="flex items-center justify-between">
        <CategoryTag category={m.category} asLink={false} />
        <span
          suppressHydrationWarning
          className="text-[10.5px] font-mono inline-flex items-center gap-1 text-[#FF4757]"
        >
          <Clock className="h-3 w-3" />
          Closes in {closing}
        </span>
      </div>
      <h3 className="font-semibold text-[16px] leading-snug">{m.question}</h3>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="YES"
          value={
            <span className="text-[#00D982]">
              {yesPrice}
              <ZapMark />
            </span>
          }
        />
        <Stat
          label="NO"
          value={
            <span className="text-[#FF4757]">
              {noPrice}
              <ZapMark />
            </span>
          }
        />
        <Stat
          label="Volume"
          value={
            <>
              {formatLargeNumber(volume)}
              <ZapMark />
            </>
          }
        />
      </div>
      <p className="text-[12.5px] text-[#8B92A8] line-clamp-3">
        {m.description}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-[#0E1016] border border-[#2A2F3D] p-2">
      <div className="text-[9px] font-mono uppercase tracking-widest text-[#5A6175]">
        {label}
      </div>
      <div className="text-base font-bold font-mono tabular-nums inline-flex items-center">
        {value}
      </div>
    </div>
  );
}
