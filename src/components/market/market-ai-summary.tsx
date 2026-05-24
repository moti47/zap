"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { useZapStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/mock-data";

interface MarketAISummaryProps {
  market: Market;
}

export function MarketAISummary({ market }: MarketAISummaryProps) {
  const live = useZapStore((s) => s.marketPrices[market.id]);
  const yesPrice = live?.yes ?? market.currentYesPrice;
  const noPrice = live?.no ?? market.currentNoPrice;

  const [summary, setSummary] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await fetch("/api/market-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          question: market.question,
          category: market.category,
          currentYesPrice: yesPrice,
          currentNoPrice: noPrice,
          priceHistory: market.priceHistory.map((p) => p.yesPrice),
          topYesHolderShares: market.topHolders.yes[0]?.shares,
          topNoHolderShares: market.topHolders.no[0]?.shares,
        }),
      });
      const data = await res.json();
      setSummary(data.summary);
      setSource(data.source ?? "");
    } catch (e) {
      setSummary(
        `Market sentiment leans ${yesPrice >= 50 ? "YES" : "NO"} at ${yesPrice}¢ — watch the resolution source.`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.id]);

  return (
    <div className="mt-6 rounded-[14px] border border-[#FFE600]/25 bg-gradient-to-br from-[#1F1A0E]/40 to-[#1A1D26] p-5 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#FFE600]/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FFE600]" /> AI Summary
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] ml-2">
              {source === "claude" ? "Claude" : source === "cache" ? "Cached" : "Auto"}
            </span>
          </h3>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchSummary();
            }}
            className="text-[#8B92A8] hover:text-white transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
        <div className="mt-3 text-[14px] leading-relaxed text-[#E5E5E5]">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
          ) : (
            <motion.p
              key={summary}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {summary}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
