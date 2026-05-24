"use client";

import Link from "next/link";
import { ChevronRight, Clock, Info, Share2, Bookmark, Activity as ActivityIcon, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { CategoryTag, LivePulseDot } from "@/components/expert-badge";
import { PriceChart } from "@/components/market/price-chart";
import { TradePanel } from "@/components/market/trade-panel";
import { MarketTabs } from "@/components/market/market-tabs";
import { MarketHeroImage } from "@/components/market/market-hero-image";
import { MarketAISummary } from "@/components/market/market-ai-summary";
import { ShareCardButton } from "@/components/market/share-card-button";
import { ResolveMarketDialog } from "@/components/market/resolve-market-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZapMark } from "@/components/zap-logo";
import { useZapStore } from "@/lib/store";
import { formatLargeNumber, timeUntil, categoryColor, categoryTextClass } from "@/lib/utils";
import type { Market } from "@/lib/fixtures";
import { useState } from "react";

interface MarketDetailClientProps {
  market: Market;
  canResolve?: boolean;
  dbStatus?: "open" | "resolved" | "cancelled" | null;
  dbOutcome?: "yes" | "no" | null;
}

export function MarketDetailClient({
  market,
  canResolve = false,
  dbStatus = null,
  dbOutcome = null,
}: MarketDetailClientProps) {
  const [resolveOpen, setResolveOpen] = useState(false);
  const live = useZapStore((s) => s.marketPrices[market.id]);
  const yesPrice = live?.yes ?? market.currentYesPrice;
  const noPrice = live?.no ?? market.currentNoPrice;
  const volume = live?.volume ?? market.totalVolume;

  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);

  return (
    <div className="px-4 lg:px-6 py-4 max-w-[1400px] mx-auto pb-24 lg:pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-[#5A6175] mb-4">
        <Link href="/markets" className="hover:text-white transition-colors">
          Markets
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/markets?cat=${market.category}`}
          className="transition-colors hover:text-white"
          style={{ color: categoryColor(market.category) }}
        >
          {market.category}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[#8B92A8] truncate max-w-[280px]">{market.question}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* MAIN COLUMN */}
        <div className="flex-1 min-w-0">
          {/* Image banner */}
          <MarketHeroImage category={market.category} className="mb-4" />
          {/* Hero */}
          <div className="rounded-[14px] border border-[#2A2F3D] bg-gradient-to-b from-[#1A1D26] to-[#14161D] p-5 lg:p-7">
            <div className="flex items-start gap-3 flex-wrap mb-4">
              <CategoryTag category={market.category} />
              <Badge variant="default" className="font-mono">
                <Clock className="h-3 w-3" />
                Resolves in {timeUntil(market.resolutionDate)}
              </Badge>
              <Badge variant="live" className="font-mono">
                <LivePulseDot />
                LIVE
              </Badge>
              <div className="ml-auto flex items-center gap-2">
                {dbStatus === "resolved" && dbOutcome && (
                  <Badge
                    variant="default"
                    className="font-mono"
                    style={{
                      background:
                        dbOutcome === "yes"
                          ? "rgba(0,217,130,0.12)"
                          : "rgba(255,71,87,0.12)",
                      color: dbOutcome === "yes" ? "#00D982" : "#FF4757",
                      borderColor:
                        dbOutcome === "yes"
                          ? "rgba(0,217,130,0.4)"
                          : "rgba(255,71,87,0.4)",
                    }}
                  >
                    <Trophy className="h-3 w-3" />
                    Resolved {dbOutcome.toUpperCase()}
                  </Badge>
                )}
                {canResolve && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolveOpen(true)}
                    className="border-[#FFB800]/40 text-[#FFB800] hover:bg-[#FFB800]/10"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Resolve
                  </Button>
                )}
                <ShareCardButton market={market} />
                <Button size="sm" variant="ghost">
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h1 className="text-2xl lg:text-[32px] font-bold leading-tight tracking-tight">
              {market.question}
            </h1>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#2A2F3D] rounded-md overflow-hidden border border-[#2A2F3D]">
              <Stat label="YES" value={`${yesPrice}¢`} className="text-[#00D982]" />
              <Stat label="NO" value={`${noPrice}¢`} className="text-[#FF4757]" />
              <Stat
                label="Volume"
                value={
                  <span className="inline-flex items-center">
                    {formatLargeNumber(volume)}
                    <ZapMark />
                  </span>
                }
              />
              <Stat label="Traders" value={market.traders.toLocaleString()} />
            </div>
          </div>

          {/* AI Summary */}
          <MarketAISummary market={market} />

          {/* Chart */}
          <div className="mt-6 rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 lg:p-6">
            <PriceChart history={market.priceHistory} currentPrice={yesPrice} />
          </div>

          {/* Tabs */}
          <MarketTabs market={market} />

          {/* Description */}
          <div className="mt-6 rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5">
            <h3 className="text-[13px] font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-[#FFE600]" /> About this market
            </h3>
            <p className="mt-3 text-sm text-[#8B92A8] leading-relaxed">
              {market.description}
            </p>
            <div className="mt-4 pt-4 border-t border-[#2A2F3D] grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <div className="text-[#5A6175] uppercase tracking-widest">Resolution source</div>
                <div className="text-white mt-1">{market.resolutionSource}</div>
              </div>
              <div>
                <div className="text-[#5A6175] uppercase tracking-widest">Resolution date</div>
                <div className="text-white mt-1">
                  {new Date(market.resolutionDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDE COLUMN (sticky) — desktop only */}
        <div className="hidden lg:block w-[360px] flex-shrink-0">
          <div className="sticky top-20">
            <TradePanel market={market} />
          </div>
        </div>
      </div>

      {/* Mobile bottom action bar */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-30 p-3 border-t border-[#2A2F3D] bg-[#0A0B0F]/95 backdrop-blur-md">
        <div className="flex gap-2">
          <Button
            variant="yes"
            className="flex-1"
            onClick={() => setTradeSheetOpen(true)}
          >
            Buy YES · {yesPrice}¢
          </Button>
          <Button
            variant="no"
            className="flex-1"
            onClick={() => setTradeSheetOpen(true)}
          >
            Buy NO · {noPrice}¢
          </Button>
        </div>
      </div>

      <ResolveMarketDialog
        marketId={market.id}
        marketQuestion={market.question}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
      />

      {tradeSheetOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setTradeSheetOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-[20px] border-t border-[#2A2F3D]"
          >
            <TradePanel market={market} className="rounded-t-[20px] rounded-b-none" />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-[#15171F] p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold font-mono tabular-nums ${className}`}>
        {value}
      </div>
    </div>
  );
}
