"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Wallet, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { useViewer } from "@/lib/use-viewer";
import { CategoryTag } from "@/components/expert-badge";
import { SellSheet } from "@/components/market/sell-sheet";
import { ZapMark } from "@/components/zap-logo";
import { cn } from "@/lib/utils";

/**
 * Portfolio view — server-rendered against real Supabase positions.
 *
 * No more Zustand fakery: each row reflects the actual `positions`
 * table joined with `markets` (live yes/no price, category, resolution
 * date). Aggregate buy-in, live valuation, and PnL are derived from
 * those real numbers. Balance is sourced from `useViewer` so the
 * realtime Postgres channel keeps it in lockstep with the topbar pill.
 */
interface ServerPosition {
  id?: string;
  market_id: string;
  side: "YES" | "NO";
  shares: number;
  avg_price: number;
  market?: {
    id: string;
    question: string;
    yes_price: number;
    no_price: number;
    status: string;
    outcome: string | null;
    resolution_date: string | null;
    category?: { slug: string; name: string; color: string } | null;
  } | null;
}

interface Row {
  marketId: string;
  question: string;
  category?: { slug: string; name: string; color: string } | null;
  side: "YES" | "NO";
  shares: number;
  avgPrice: number;
  staked: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  resolved: boolean;
  outcome: string | null;
  resolutionDate: string | null;
}

interface Props {
  initialPositions: ServerPosition[];
  initialBalance: number;
  initialSignedIn: boolean;
}

export function PortfolioView({
  initialPositions,
  initialBalance,
  initialSignedIn,
}: Props) {
  const { viewer } = useViewer();
  const [sellTarget, setSellTarget] = useState<{
    marketId: string;
    side: "YES" | "NO";
  } | null>(null);

  const balance = viewer?.zaps ?? initialBalance;

  const rows = useMemo<Row[]>(() => {
    return initialPositions
      .map<Row | null>((p) => {
        if (!p.market) return null;
        const currentPrice =
          p.side === "YES" ? p.market.yes_price : p.market.no_price;
        const staked = Math.round((p.shares * p.avg_price) / 100);
        const currentValue = Math.round((p.shares * currentPrice) / 100);
        const pnl = currentValue - staked;
        const pnlPct = staked > 0 ? Math.round((pnl / staked) * 100) : 0;
        return {
          marketId: p.market.id,
          question: p.market.question,
          category: p.market.category ?? null,
          side: p.side,
          shares: p.shares,
          avgPrice: p.avg_price,
          staked,
          currentPrice,
          currentValue,
          pnl,
          pnlPct,
          resolved: p.market.status === "resolved",
          outcome: p.market.outcome ?? null,
          resolutionDate: p.market.resolution_date ?? null,
        };
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [initialPositions]);

  const totals = useMemo(() => {
    const staked = rows.reduce((sum, r) => sum + r.staked, 0);
    const value = rows.reduce((sum, r) => sum + r.currentValue, 0);
    const pnl = value - staked;
    const pnlPct = staked > 0 ? Math.round((pnl / staked) * 100) : 0;
    return { staked, value, pnl, pnlPct };
  }, [rows]);

  // Server already resolved the auth gate — show signed-out state
  // immediately, no skeleton flicker.
  if (!initialSignedIn) {
    return (
      <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-10 text-center">
        <Wallet className="h-7 w-7 text-[#FFE600] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Sign in to see your portfolio</h2>
        <p className="text-sm text-[#8B92A8] mt-2 max-w-md mx-auto">
          Your active prediction-market positions live here. Sign in to
          track buy-in cost, live valuation, and PnL.
        </p>
        <Link
          href="/auth/sign-in?next=/portfolio"
          className="inline-flex items-center px-4 h-9 rounded-md text-sm font-semibold bg-[#FFE600] text-[#0E1016] hover:scale-[1.03] active:scale-95 transition-transform mt-5"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            My Portfolio
          </h1>
          <p className="text-sm text-[#8B92A8] mt-1">
            Active positions, buy-in cost, and live valuation — denominated in Zaps.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-[#5A6175] font-mono">
            Live balance
          </div>
          <div className="text-2xl font-bold tabular-nums text-white inline-flex items-center gap-1.5">
            {balance.toLocaleString()}
            <ZapMark className="h-4 w-4" />
          </div>
        </div>
      </header>

      <section
        aria-label="Portfolio summary"
        className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#2A2F3D] rounded-[14px] overflow-hidden border border-[#2A2F3D]"
      >
        <SummaryStat
          label="Open positions"
          value={rows.length.toString()}
          icon={<PieChart className="h-3.5 w-3.5" />}
          plain
        />
        <SummaryStat
          label="Buy-in cost"
          value={totals.staked.toLocaleString()}
          icon={<Wallet className="h-3.5 w-3.5" />}
        />
        <SummaryStat
          label="Live valuation"
          value={totals.value.toLocaleString()}
          icon={<ZapMark className="h-3.5 w-3.5" />}
        />
        <SummaryStat
          label={`Unrealized PnL${totals.staked > 0 ? ` · ${totals.pnlPct >= 0 ? "+" : ""}${totals.pnlPct}%` : ""}`}
          value={`${totals.pnl >= 0 ? "+" : ""}${totals.pnl.toLocaleString()}`}
          icon={
            totals.pnl >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )
          }
          colorClass={totals.pnl >= 0 ? "text-[#00D982]" : "text-[#FF4757]"}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-white">Active positions</h2>
        {rows.length === 0 ? (
          <div className="mt-3 rounded-[14px] border border-dashed border-[#2A2F3D] p-10 text-center">
            <p className="text-sm text-[#8B92A8]">
              You don&apos;t hold any contracts yet. Pick a market and
              take a position to see it here.
            </p>
            <Link
              href="/markets"
              className="inline-flex items-center gap-1 px-3 h-9 rounded-md text-sm font-semibold bg-[#FFE600] text-[#0E1016] mt-4 hover:scale-[1.03] active:scale-95 transition-transform"
            >
              Browse markets <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <PositionRow
                key={`${row.marketId}-${row.side}`}
                row={row}
                onSell={() =>
                  setSellTarget({
                    marketId: row.marketId,
                    side: row.side,
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {sellTarget && (
        <SellSheet
          open={!!sellTarget}
          onOpenChange={(open) => !open && setSellTarget(null)}
          marketId={sellTarget.marketId}
          initialSide={sellTarget.side}
        />
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon,
  colorClass,
  plain,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass?: string;
  plain?: boolean;
}) {
  return (
    <div className="bg-[#1A1D26] p-4">
      <div className="text-[10px] uppercase tracking-widest text-[#5A6175] font-mono inline-flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tabular-nums inline-flex items-center gap-1",
          colorClass ?? "text-white",
        )}
      >
        {value}
        {!plain && <ZapMark className="h-3.5 w-3.5" />}
      </div>
    </div>
  );
}

function PositionRow({ row, onSell }: { row: Row; onSell: () => void }) {
  const isYes = row.side === "YES";
  const sideColor = isYes ? "#00D982" : "#FF4757";
  const resolvedWin =
    row.resolved &&
    ((row.outcome === "YES" && row.side === "YES") ||
      (row.outcome === "NO" && row.side === "NO"));
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] border border-[#2A2F3D] bg-[#14161D] p-4 hover:border-[#353B4D] transition-colors"
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <Link
            href={`/market/${row.marketId}`}
            className="text-[15px] font-semibold text-white hover:text-[#FFE600] transition-colors line-clamp-2"
          >
            {row.question}
          </Link>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {row.category && <CategoryTag category={row.category.slug} />}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold uppercase tracking-wider"
              style={{
                background: `${sideColor}1A`,
                color: sideColor,
                border: `1px solid ${sideColor}40`,
              }}
            >
              {row.side}
            </span>
            <span className="text-[11px] font-mono text-[#5A6175] tabular-nums">
              {row.shares.toLocaleString()} shares @ {row.avgPrice}% avg
            </span>
            {row.resolved && (
              <span
                className={cn(
                  "text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                  resolvedWin
                    ? "bg-[#00D982]/15 text-[#00D982] border border-[#00D982]/40"
                    : "bg-[#FF4757]/15 text-[#FF4757] border border-[#FF4757]/40",
                )}
              >
                Resolved · {row.outcome ?? "—"}
              </span>
            )}
          </div>
        </div>
        {!row.resolved && (
          <button
            type="button"
            onClick={onSell}
            className="text-[11px] font-bold px-3 h-8 rounded-md border border-[#2A2F3D] hover:border-[#FFE600]/40 hover:text-[#FFE600] text-white transition-colors"
          >
            Sell
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-[12px] font-mono">
        <Stat label="Buy-in" value={`${row.staked.toLocaleString()}⚡`} />
        <Stat
          label="Live value"
          value={`${row.currentValue.toLocaleString()}⚡`}
          accent="white"
        />
        <Stat
          label="PnL"
          value={`${row.pnl >= 0 ? "+" : ""}${row.pnl.toLocaleString()}⚡ (${
            row.pnlPct >= 0 ? "+" : ""
          }${row.pnlPct}%)`}
          accent={row.pnl >= 0 ? "green" : "red"}
        />
      </div>
    </motion.li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "white" | "green" | "red";
}) {
  const color =
    accent === "green"
      ? "text-[#00D982]"
      : accent === "red"
        ? "text-[#FF4757]"
        : accent === "white"
          ? "text-white"
          : "text-[#8B92A8]";
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-widest text-[#5A6175]">
        {label}
      </div>
      <div className={cn("mt-0.5 tabular-nums", color)}>{value}</div>
    </div>
  );
}
