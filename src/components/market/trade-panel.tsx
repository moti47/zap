"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Zap as ZapIcon,
  TrendingUp,
  TrendingDown,
  Activity,
  Trophy,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Slider } from "../ui/slider";
import { ZapMark } from "../zap-logo";
import { useZapStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { cn, formatLargeNumber } from "@/lib/utils";
import type { Market } from "@/lib/fixtures";

interface TradePanelProps {
  market: Market;
  className?: string;
}

type Mode = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";
type Side = "YES" | "NO";

const QUICK_CHIPS = [10, 50, 100, 500] as const;

export function TradePanel({ market, className }: TradePanelProps) {
  const points = useZapStore((s) => s.points);
  const positions = useZapStore(useShallow((s) => s.positions));
  const buyShares = useZapStore((s) => s.buyShares);
  const sellShares = useZapStore((s) => s.sellShares);
  const live = useZapStore((s) => s.marketPrices[market.id]);

  const yesPos = positions.find((p) => p.marketId === market.id && p.side === "YES");
  const noPos = positions.find((p) => p.marketId === market.id && p.side === "NO");
  const hasAny = !!(yesPos || noPos);

  const [mode, setMode] = useState<Mode>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState(50);
  const [proOpen, setProOpen] = useState(false);

  const yesPrice = live?.yes ?? market.currentYesPrice;
  const noPrice = live?.no ?? market.currentNoPrice;
  const price = side === "YES" ? yesPrice : noPrice;

  const myPos = side === "YES" ? yesPos : noPos;

  // Compute max value depending on mode
  const buyMaxZaps = Math.min(points, 5000);
  const sellMaxShares = myPos?.shares ?? 0;
  const sliderMax = mode === "BUY" ? Math.max(50, buyMaxZaps) : Math.max(1, sellMaxShares);
  const clampedAmount = Math.min(amount, sliderMax);

  // For BUY: `amount` is zaps spent. shares = amount / price * 100
  // For SELL: `amount` is shares sold. proceeds = amount * price / 100
  const tradeShares =
    mode === "BUY" ? Math.floor((clampedAmount / Math.max(1, price)) * 100) : clampedAmount;
  const tradeCost =
    mode === "BUY" ? clampedAmount : Math.round((clampedAmount * price) / 100);
  const potentialProfit =
    mode === "BUY" ? Math.max(0, tradeShares - clampedAmount) : 0;
  const breakEven = price;

  // Position summary at current price (always shown, regardless of selected side)
  const positionSummary = useMemo(() => {
    if (!hasAny) return null;
    const pos = myPos ?? yesPos ?? noPos!;
    const livePrice = pos.side === "YES" ? yesPrice : noPrice;
    const currentValue = Math.round((pos.shares * livePrice) / 100);
    const pnl = currentValue - pos.staked;
    return { pos, currentValue, pnl };
  }, [hasAny, myPos, yesPos, noPos, yesPrice, noPrice]);

  // Synthetic order book — derived from market price, 5 levels each side.
  const bookLevels = useMemo(() => {
    const center = price;
    const baseSize = Math.max(50, Math.round(market.totalVolume / 800));
    const make = (offset: number, dir: "bid" | "ask") => {
      const p = Math.max(1, Math.min(99, center + (dir === "ask" ? offset : -offset)));
      const sizeJitter = 0.7 + ((offset * 13) % 10) / 10;
      return { price: p, size: Math.round(baseSize * sizeJitter * (6 - offset)) };
    };
    const bids = [1, 2, 3, 4, 5].map((i) => make(i, "bid"));
    const asks = [1, 2, 3, 4, 5].map((i) => make(i, "ask")).reverse();
    const maxSize = Math.max(...bids.map((b) => b.size), ...asks.map((a) => a.size));
    return { bids, asks, maxSize };
  }, [price, market.totalVolume]);

  const sellDisabled = !hasAny;

  const handleAction = () => {
    if (mode === "BUY") {
      if (clampedAmount > points) {
        toast.error("Not enough Zaps", {
          description: `You need ${clampedAmount}⚡ — have ${points}⚡`,
        });
        return;
      }
      if (tradeShares <= 0) {
        toast.error("Amount too small");
        return;
      }
      buyShares(market.id, side, tradeShares, price);
      toast.success(`Bought ${tradeShares} ${side} @ ${price}¢`, {
        description: `Staked ${clampedAmount}⚡ · Potential profit +${potentialProfit}⚡`,
      });
    } else {
      if (!myPos || tradeShares > myPos.shares) {
        toast.error("Not enough shares to sell");
        return;
      }
      sellShares(market.id, side, tradeShares, price);
      toast.success(`Sold ${tradeShares} ${side} @ ${price}¢`, {
        description: `+${tradeCost}⚡ to balance`,
      });
    }
    setAmount(mode === "BUY" ? 50 : Math.max(1, Math.floor(sliderMax / 2)));
  };

  const handleModeChange = (m: Mode) => {
    if (m === "SELL" && !hasAny) return;
    setMode(m);
    if (m === "SELL") {
      // Default to side we hold
      if (!myPos && yesPos) setSide("YES");
      else if (!myPos && noPos) setSide("NO");
      const startQty = (myPos ?? yesPos ?? noPos)?.shares ?? 0;
      setAmount(Math.max(1, Math.floor(startQty / 2)));
    } else {
      setAmount(50);
    }
  };

  const balanceAfter =
    mode === "BUY" ? points - clampedAmount : points + tradeCost;

  return (
    <div
      className={cn(
        "rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden",
        className
      )}
    >
      {/* BUY / SELL tabs */}
      <div
        className="grid grid-cols-2 border-b border-[#2A2F3D]"
        role="tablist"
        aria-label="Trade mode"
      >
        {(["BUY", "SELL"] as const).map((m) => {
          const active = mode === m;
          const disabled = m === "SELL" && sellDisabled;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={active}
              disabled={disabled}
              title={disabled ? "Buy shares first to enable sell" : undefined}
              onClick={() => handleModeChange(m)}
              className={cn(
                "relative py-3 text-[12px] font-bold uppercase tracking-[0.14em] transition-colors",
                active ? "text-white bg-[#14161D]" : "text-[#8B92A8] hover:text-white",
                disabled && "opacity-40 cursor-not-allowed hover:text-[#8B92A8]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="trade-mode-line"
                  className="absolute bottom-0 inset-x-0 h-[2px] bg-[#FFE600]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {m}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Order type pills */}
        <div className="flex items-center justify-between">
          <div className="inline-flex p-0.5 rounded-md bg-[#14161D] border border-[#2A2F3D]">
            {(["MARKET", "LIMIT"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors",
                  orderType === t
                    ? "bg-[#20232E] text-white shadow-[inset_0_0_0_1px_#353B4D]"
                    : "text-[#5A6175] hover:text-white"
                )}
              >
                {t === "LIMIT" ? "Limit" : "Market"}
                {t === "LIMIT" && (
                  <span className="ml-1 text-[9px] text-[#5A6175]">soon</span>
                )}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#00D982] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00D982]" />
            </span>
            Live
          </div>
        </div>

        {/* YES/NO big buttons */}
        <div className="grid grid-cols-2 gap-2">
          <SideButton
            side="YES"
            price={yesPrice}
            label={mode === "BUY" ? "Buy YES" : "Sell YES"}
            active={side === "YES"}
            heldShares={yesPos?.shares}
            disabledHint={
              mode === "SELL" && !yesPos
                ? "You don't hold YES"
                : undefined
            }
            onClick={() => mode === "BUY" || yesPos ? setSide("YES") : undefined}
            disabled={mode === "SELL" && !yesPos}
          />
          <SideButton
            side="NO"
            price={noPrice}
            label={mode === "BUY" ? "Buy NO" : "Sell NO"}
            active={side === "NO"}
            heldShares={noPos?.shares}
            disabledHint={
              mode === "SELL" && !noPos
                ? "You don't hold NO"
                : undefined
            }
            onClick={() => mode === "BUY" || noPos ? setSide("NO") : undefined}
            disabled={mode === "SELL" && !noPos}
          />
        </div>

        {/* Current position banner — always visible if any position */}
        {positionSummary && (
          <div
            className={cn(
              "rounded-md border p-2.5 text-[11.5px] font-mono flex items-center justify-between",
              positionSummary.pnl >= 0
                ? "border-[#00D982]/30 bg-[#00D982]/8 text-[#00D982]"
                : "border-[#FF4757]/30 bg-[#FF4757]/8 text-[#FF4757]"
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-[#cfd3df]">
              You hold{" "}
              <span className="text-white font-semibold">
                {positionSummary.pos.shares.toLocaleString()}{" "}
                {positionSummary.pos.side}
              </span>
            </span>
            <span className="inline-flex items-center gap-3">
              <span className="text-[#cfd3df]">
                Value{" "}
                <span className="text-white font-semibold">
                  {positionSummary.currentValue}
                  <ZapMark />
                </span>
              </span>
              <span
                className={cn(
                  "font-semibold inline-flex items-center",
                  positionSummary.pnl >= 0 ? "text-[#00D982]" : "text-[#FF4757]"
                )}
              >
                {positionSummary.pnl >= 0 ? "+" : ""}
                {positionSummary.pnl}
                <ZapMark />
              </span>
            </span>
          </div>
        )}

        {/* Amount input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="trade-amount"
              className="text-[10px] font-mono uppercase tracking-widest text-[#8B92A8]"
            >
              {mode === "BUY" ? "Amount (Zaps)" : "Shares to sell"}
            </label>
            <span className="text-[10px] font-mono text-[#5A6175]">
              {mode === "BUY"
                ? `Balance ${points.toLocaleString()}⚡`
                : `Held ${sellMaxShares.toLocaleString()}`}
            </span>
          </div>
          <div className="relative">
            <Input
              id="trade-amount"
              type="number"
              value={clampedAmount}
              min={1}
              max={sliderMax}
              onChange={(e) =>
                setAmount(
                  Math.max(1, Math.min(sliderMax, Number(e.target.value) || 0))
                )
              }
              className="text-xl font-mono font-bold h-12 pr-10 tabular-nums"
            />
            {mode === "BUY" ? (
              <ZapMark className="absolute right-3 top-1/2 -translate-y-1/2 lg" />
            ) : (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#5A6175]">
                sh
              </span>
            )}
          </div>
          <Slider
            value={[clampedAmount]}
            onValueChange={(v) => setAmount(v[0])}
            max={sliderMax}
            step={mode === "BUY" ? 5 : 1}
            className="mt-3"
          />
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {QUICK_CHIPS.map((q) => {
              const eff =
                mode === "SELL" && q > sellMaxShares ? sellMaxShares : q;
              const disabled = mode === "SELL" && sellMaxShares === 0;
              return (
                <button
                  key={q}
                  disabled={disabled}
                  onClick={() => setAmount(eff)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-mono text-[11px] border transition-colors",
                    clampedAmount === eff && !disabled
                      ? "border-[#FFE600] bg-[#FFE600]/10 text-[#FFE600]"
                      : "border-[#2A2F3D] text-[#8B92A8] hover:text-white hover:border-[#353B4D]",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {q}
                  {mode === "BUY" && "⚡"}
                </button>
              );
            })}
            <button
              onClick={() => setAmount(sliderMax)}
              className="px-2.5 py-1 rounded-md font-mono text-[11px] border border-[#2A2F3D] text-[#FFE600] hover:bg-[#FFE600]/10"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Estimated fill */}
        <div className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-3 space-y-1.5">
          <Row
            label="Avg price"
            value={
              <>
                {price}
                <ZapMark />
              </>
            }
          />
          <Row label="Shares" value={tradeShares.toLocaleString()} />
          <Row
            label="Total cost"
            value={
              <>
                {tradeCost}
                <ZapMark />
              </>
            }
          />
          <div className="border-t border-[#2A2F3D] my-1.5" />
          {mode === "BUY" ? (
            <>
              <Row
                label="Max profit if right"
                value={
                  <span className="text-[#00D982]">
                    +{potentialProfit}
                    <ZapMark />
                  </span>
                }
              />
              <Row
                label="Break-even"
                value={
                  <>
                    {breakEven}
                    <ZapMark />
                  </>
                }
              />
            </>
          ) : (
            <Row
              label="Proceeds"
              value={
                <span className="text-[#FFE600]">
                  +{tradeCost}
                  <ZapMark />
                </span>
              }
            />
          )}
        </div>

        {/* Order book preview */}
        <div className="rounded-md border border-[#2A2F3D] bg-[#0E1016]">
          <div className="px-3 py-2 flex items-center justify-between border-b border-[#2A2F3D]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8B92A8]">
              Order book · {side}
            </span>
            <span className="text-[10px] font-mono text-[#5A6175]">5 levels</span>
          </div>
          <div className="px-3 py-2 space-y-px text-[11px] font-mono">
            {bookLevels.asks.map((lv, i) => (
              <BookRow
                key={`ask-${i}`}
                price={lv.price}
                size={lv.size}
                maxSize={bookLevels.maxSize}
                type="ask"
              />
            ))}
            <div className="flex items-center justify-between py-1 my-0.5 border-y border-[#2A2F3D] bg-[#14161D] px-2 -mx-2">
              <span className="text-white font-semibold">
                Last {price}
                <ZapMark />
              </span>
              <span className="text-[#5A6175]">spread 1.0</span>
            </div>
            {bookLevels.bids.map((lv, i) => (
              <BookRow
                key={`bid-${i}`}
                price={lv.price}
                size={lv.size}
                maxSize={bookLevels.maxSize}
                type="bid"
              />
            ))}
          </div>
        </div>

        {/* Pro toggle */}
        <button
          type="button"
          onClick={() => setProOpen((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-[#8B92A8] hover:text-white px-3 py-2 rounded-md border border-[#2A2F3D] bg-[#14161D]"
        >
          <span className="inline-flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Pro details
          </span>
          {proOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {proOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-3 space-y-1.5"
          >
            <Row
              label="24h volume"
              value={
                <>
                  {formatLargeNumber(market.totalVolume)}
                  <ZapMark />
                </>
              }
            />
            <Row
              label="Open interest"
              value={
                <>
                  {formatLargeNumber(Math.round(market.totalVolume * 0.62))}
                  <ZapMark />
                </>
              }
            />
            <Row
              label="Traders"
              value={market.traders.toLocaleString()}
            />
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  Top trader on {side}
                  <Trophy className="h-3 w-3 text-[#FFB800]" />
                </span>
              }
              value={
                <span className="text-[#00D982]">
                  72% win rate
                </span>
              }
            />
          </motion.div>
        )}

        {/* Action button */}
        <motion.div whileTap={{ scale: 0.985 }}>
          <Button
            onClick={handleAction}
            variant={side === "YES" ? "yes" : "no"}
            size="lg"
            className="w-full text-base"
            disabled={tradeShares <= 0 || (mode === "SELL" && !myPos)}
          >
            <ZapIcon className="h-4 w-4" />
            {mode === "BUY"
              ? `Buy ${tradeShares} ${side} for ${clampedAmount}`
              : `Sell ${tradeShares} ${side} for ${tradeCost}`}
            <ZapMark />
          </Button>
        </motion.div>

        <div className="text-[10.5px] font-mono text-center text-[#5A6175]">
          Balance after trade:{" "}
          <span className="text-white">
            {Math.max(0, balanceAfter).toLocaleString()}⚡
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between text-[12.5px]">
      <span className="text-[#8B92A8]">{label}</span>
      <span className="font-mono font-semibold inline-flex items-center text-white">
        {value}
      </span>
    </div>
  );
}

function SideButton({
  side,
  price,
  label,
  active,
  heldShares,
  onClick,
  disabled,
  disabledHint,
}: {
  side: Side;
  price: number;
  label: string;
  active: boolean;
  heldShares?: number;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const color = side === "YES" ? "#00D982" : "#FF4757";
  const Icon = side === "YES" ? TrendingUp : TrendingDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabledHint}
      className={cn(
        "relative p-3 rounded-md border-2 transition-all text-left",
        active
          ? "bg-[var(--c)]/10"
          : "bg-[#14161D] hover:border-[#353B4D]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
      style={
        {
          // active border vs idle
          borderColor: active ? color : "#2A2F3D",
          ["--c" as string]: color,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#5A6175]">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div
        className="text-[28px] leading-none font-bold font-mono mt-1.5 flex items-baseline"
        style={{ color }}
      >
        {price}
        <ZapMark className="lg ml-0.5" />
      </div>
      {typeof heldShares === "number" && heldShares > 0 && (
        <div className="text-[10px] font-mono text-[#8B92A8] mt-1">
          Held {heldShares.toLocaleString()}
        </div>
      )}
    </button>
  );
}

function BookRow({
  price,
  size,
  maxSize,
  type,
}: {
  price: number;
  size: number;
  maxSize: number;
  type: "bid" | "ask";
}) {
  const pct = Math.min(100, (size / maxSize) * 100);
  const color = type === "bid" ? "#00D982" : "#FF4757";
  return (
    <div className="relative flex items-center justify-between px-2 py-0.5 -mx-2">
      <span
        className="absolute inset-y-0 right-0 opacity-15"
        style={{ width: `${pct}%`, background: color }}
      />
      <span className="relative" style={{ color }}>
        {price}
        <ZapMark />
      </span>
      <span className="relative text-[#8B92A8] tabular-nums">{size}</span>
    </div>
  );
}
