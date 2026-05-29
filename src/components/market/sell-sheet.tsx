"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { CategoryTag } from "../expert-badge";
import { ZapMark } from "../zap-logo";
import { useShallow } from "zustand/react/shallow";
import { useZapStore } from "@/lib/store";
import { getMarket } from "@/lib/fixtures";
import { cn } from "@/lib/utils";

interface SellSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  marketId: string;
  /** Optional side to pre-select; otherwise picks the side the user holds */
  initialSide?: "YES" | "NO";
}

export function SellSheet({ open, onOpenChange, marketId, initialSide }: SellSheetProps) {
  const market = getMarket(marketId);
  const positions = useZapStore(useShallow((s) => s.positions));
  const live = useZapStore((s) => s.marketPrices[marketId]);
  const sellPosition = useZapStore((s) => s.sellPosition);

  const yesPos = positions.find((p) => p.marketId === marketId && p.side === "YES");
  const noPos = positions.find((p) => p.marketId === marketId && p.side === "NO");

  const defaultSide: "YES" | "NO" =
    initialSide ?? (yesPos ? "YES" : noPos ? "NO" : "YES");
  const [side, setSide] = useState<"YES" | "NO">(defaultSide);
  const [qty, setQty] = useState<number>(0);

  const pos = side === "YES" ? yesPos : noPos;
  const otherPos = side === "YES" ? noPos : yesPos;
  const price = side === "YES" ? live?.yes ?? market?.currentYesPrice ?? 50 : live?.no ?? market?.currentNoPrice ?? 50;

  useEffect(() => {
    if (open) {
      setSide(defaultSide);
      setQty(pos ? Math.floor(pos.shares / 2) : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, marketId]);

  useEffect(() => {
    setQty(pos ? Math.floor(pos.shares / 2) : 0);
  }, [side, pos?.shares]);

  if (!market) return null;

  const heldValue = pos ? Math.round((pos.shares * price) / 100) : 0;
  const pnl = pos ? heldValue - pos.staked : 0;
  const proceeds = Math.round((qty * price) / 100);
  const canSell = !!pos && qty > 0 && qty <= (pos?.shares ?? 0);

  const confirm = () => {
    if (!canSell || !pos) return;
    sellPosition(market.id, side, qty);
    toast.success(`Sold ${qty} ${side} @ ${price}% Probability`, {
      description: `+${proceeds}⚡ to balance`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-5 border-b border-[#2A2F3D] bg-[#0E1016]">
          <DialogHeader>
            <CategoryTag category={market.category} />
            <DialogTitle className="text-lg leading-tight mt-1">
              Sell shares — {market.question}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Sell shares you hold in this market.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          {/* Side selector — only sides the user holds */}
          <div className="grid grid-cols-2 gap-2">
            <SideBtn
              side="YES"
              active={side === "YES"}
              disabled={!yesPos}
              price={live?.yes ?? market.currentYesPrice}
              held={yesPos?.shares ?? 0}
              onClick={() => setSide("YES")}
            />
            <SideBtn
              side="NO"
              active={side === "NO"}
              disabled={!noPos}
              price={live?.no ?? market.currentNoPrice}
              held={noPos?.shares ?? 0}
              onClick={() => setSide("NO")}
            />
          </div>

          {!pos && !otherPos ? (
            <div className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-4 text-sm text-[#FF4757]">
              You don't hold any shares in this market yet.
            </div>
          ) : !pos ? (
            <div className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-4 text-sm text-[#8B92A8]">
              You don't hold any {side} shares — switch sides.
            </div>
          ) : (
            <>
              <div className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-3 space-y-1.5 text-sm">
                <Row label={`You hold`} value={
                  <span className="inline-flex items-center">
                    {pos.shares} {side} @ avg {pos.avgPrice}<ZapMark />
                  </span>
                } />
                <Row label="Current value" value={
                  <span className="inline-flex items-center">{heldValue}<ZapMark /></span>
                } />
                <Row label="P&L" value={
                  <span className={cn("inline-flex items-center", pnl >= 0 ? "text-[#00D982]" : "text-[#FF4757]")}>
                    {pnl >= 0 ? "+" : ""}{pnl}<ZapMark />
                  </span>
                } />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#8B92A8]">
                  Shares to sell
                </label>
                <input
                  type="number"
                  min={0}
                  max={pos.shares}
                  value={qty}
                  onChange={(e) =>
                    setQty(Math.max(0, Math.min(pos.shares, Number(e.target.value))))
                  }
                  className="mt-1 w-full bg-[#14161D] border border-[#2A2F3D] rounded-md px-3 py-2 text-lg font-mono font-bold focus:outline-none focus:border-[#353B4D]"
                />
                <div className="mt-2 flex gap-2 flex-wrap">
                  {[
                    { label: "25%", v: Math.floor(pos.shares * 0.25) },
                    { label: "50%", v: Math.floor(pos.shares * 0.5) },
                    { label: "75%", v: Math.floor(pos.shares * 0.75) },
                    { label: "MAX", v: pos.shares },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setQty(q.v)}
                      className={cn(
                        "px-3 py-1 rounded-md font-mono text-xs border transition-colors",
                        qty === q.v
                          ? "border-[#FFE600] bg-[#FFE600]/10 text-[#FFE600]"
                          : "border-[#2A2F3D] text-[#8B92A8] hover:text-white"
                      )}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-3 space-y-2">
                <Row label="Sell price" value={
                  <span className="inline-flex items-center font-mono font-semibold">{price}<ZapMark /></span>
                } />
                <Row label="Proceeds" value={
                  <span className="inline-flex items-center font-mono font-semibold text-[#FFE600]">{proceeds}<ZapMark /></span>
                } />
              </div>

              <Button
                onClick={confirm}
                disabled={!canSell}
                variant={side === "YES" ? "yes" : "no"}
                size="lg"
                className="w-full"
              >
                Sell {qty} {side} for {proceeds}<ZapMark />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SideBtn({
  side,
  active,
  disabled,
  price,
  held,
  onClick,
}: {
  side: "YES" | "NO";
  active: boolean;
  disabled: boolean;
  price: number;
  held: number;
  onClick: () => void;
}) {
  const color = side === "YES" ? "#00D982" : "#FF4757";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-3 rounded-md border-2 text-left transition-all",
        active && !disabled
          ? "bg-opacity-10"
          : "bg-[#14161D]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
      style={{
        borderColor: active ? color : "#2A2F3D",
        background: active ? `${color}1A` : undefined,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#5A6175]">
        Sell {side} at
      </div>
      <div className="text-2xl font-bold font-mono flex items-center" style={{ color }}>
        {price}<ZapMark />
      </div>
      <div className="text-[10px] font-mono text-[#8B92A8] mt-0.5">
        Held: {held}
      </div>
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#8B92A8]">{label}</span>
      {value}
    </div>
  );
}
