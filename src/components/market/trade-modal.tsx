"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { CategoryTag } from "../expert-badge";
import { TradePanel } from "./trade-panel";
import { getMarket } from "@/lib/mock-data";

interface TradeModalProps {
  marketId: string | null;
  initialSide?: "YES" | "NO";
  initialMode?: "BUY" | "SELL";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TradeModal({
  marketId,
  open,
  onOpenChange,
}: TradeModalProps) {
  const market = marketId ? getMarket(marketId) : null;
  if (!market) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-[#0E1016] border-[#2A2F3D]">
        <DialogHeader className="p-5 pb-3 border-b border-[#2A2F3D]">
          <CategoryTag category={market.category} />
          <DialogTitle className="text-base leading-tight mt-1.5 pr-6">
            {market.question}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Trade panel for {market.question}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto thin-scrollbar">
          <TradePanel
            market={market}
            className="rounded-none border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
