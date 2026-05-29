"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { CategoryTag, LivePulseDot } from "../expert-badge";
import { PriceDisplay } from "./price-display";
import { Sparkline } from "./sparkline";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { ZapMark } from "../zap-logo";
import { TradeModal } from "./trade-modal";
import type { Market } from "@/lib/fixtures";
import { useZapStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { formatLargeNumber, timeUntil, cn } from "@/lib/utils";
import { toggleMarketBookmarkAction } from "@/app/actions/social";

interface MarketCardCompactProps {
  market: Market;
  variant?: "default" | "compact" | "embedded";
  showPositionTag?: boolean;
}

export function MarketCardCompact({ market, variant = "embedded" }: MarketCardCompactProps) {
  const live = useZapStore((s) => s.marketPrices[market.id]);
  const positions = useZapStore(useShallow((s) => s.positions));
  const saved = useZapStore((s) => s.savedMarketIds.includes(market.id));
  const toggleSave = useZapStore((s) => s.toggleSaveMarket);
  const yesPrice = live?.yes ?? market.currentYesPrice;
  const noPrice = live?.no ?? market.currentNoPrice;
  const volume = live?.volume ?? market.totalVolume;
  const flash = live?.flash ?? null;

  const prev = market.priceHistory[market.priceHistory.length - 2]?.yesPrice ?? yesPrice;
  const delta24h = ((yesPrice - prev) / prev) * 100;

  const myPosition = positions.find((p) => p.marketId === market.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSide, setModalSide] = useState<"YES" | "NO">("YES");

  const openTrade = (side: "YES" | "NO") => {
    setModalSide(side);
    setModalOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "rounded-md border border-[#2A2F3D] p-4 flex flex-col gap-3 transition-all hover:border-[#353B4D]",
          "bg-gradient-to-b from-[#15171F] to-[#12141B]"
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryTag category={market.category} />
          <Badge variant="outline" className="ml-auto">
            <Clock className="h-3 w-3" /> Closes in {timeUntil(market.resolutionDate)}
          </Badge>
          <button
            type="button"
            aria-label={saved ? "Remove from saved markets" : "Save market"}
            aria-pressed={saved}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const wasSaved = saved;
              toggleSave(market.id);
              toast.success(wasSaved ? "Removed from saved" : "Market saved");
              // Persist to DB so the bookmark survives reload + shows
              // up on /saved#markets. UUID-shaped ids only (fixture
              // markets stay local-only).
              if (/^[0-9a-f]{8}-/i.test(market.id)) {
                void toggleMarketBookmarkAction(market.id).then((result) => {
                  if (!result.ok) toggleSave(market.id); // rollback
                });
              }
            }}
            className={cn(
              "p-1 transition-colors",
              saved ? "text-[#FFE600]" : "text-[#5A6175] hover:text-white"
            )}
          >
            <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-[#FFE600]")} />
          </button>
        </div>

        <Link
          href={`/market/${market.id}`}
          className="font-semibold text-[15px] leading-snug hover:text-[#FFE600] transition-colors line-clamp-2"
        >
          {market.question}
        </Link>

        <div className="flex items-center gap-4">
          <PriceDisplay
            label="YES"
            price={yesPrice}
            delta={delta24h}
            flash={flash === "up" ? "up" : null}
          />
          <PriceDisplay
            label="NO"
            price={noPrice}
            delta={-delta24h}
            flash={flash === "down" ? "down" : null}
          />
          <div className="ml-auto flex items-center gap-2">
            <Sparkline data={market.priceHistory.slice(-30)} positive={delta24h >= 0} />
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                variant="yes"
                onClick={() => openTrade("YES")}
                className="h-7 px-3 text-[11px]"
              >
                Buy YES
              </Button>
              <Button
                size="sm"
                variant="noOutline"
                onClick={() => openTrade("NO")}
                className="h-7 px-3 text-[11px]"
              >
                NO
              </Button>
            </div>
          </div>
        </div>

        <Progress value={yesPrice} />

        <div className="flex items-center justify-between pt-2 border-t border-[#2A2F3D] text-[11px] font-mono text-[#8B92A8]">
          <span className="inline-flex items-center gap-2">
            <LivePulseDot />
            <span className="text-white font-semibold">
              {formatLargeNumber(volume)}
              <ZapMark />
            </span>{" "}
            volume ·{" "}
            <span className="text-white font-semibold">
              {market.traders.toLocaleString()}
            </span>{" "}
            traders
          </span>
          <span>
            <span className="text-white font-semibold">{yesPrice}%</span> implied
          </span>
        </div>

        {myPosition && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={cn(
              "rounded-md p-2.5 text-[11px] font-mono flex items-center justify-between border",
              myPosition.side === "YES"
                ? "border-[#00D982]/35 bg-[#00D982]/10 text-[#00D982]"
                : "border-[#FF4757]/35 bg-[#FF4757]/10 text-[#FF4757]"
            )}
          >
            <span>
              {myPosition.side === "YES" ? "▲" : "▼"} You hold {myPosition.shares} {myPosition.side} @{" "}
              {myPosition.avgPrice}
              <ZapMark />
            </span>
            <span className="text-[#8B92A8]">
              Stake {myPosition.staked}
              <ZapMark />
            </span>
          </motion.div>
        )}
      </div>

      <TradeModal
        marketId={modalOpen ? market.id : null}
        initialSide={modalSide}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
