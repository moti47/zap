"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ChartContainer } from "./chart-container";

const AreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
) as any;

interface PricePoint {
  timestamp: string;
  yesPrice: number;
}

interface PriceChartProps {
  history: PricePoint[];
  currentPrice: number;
  className?: string;
}

type Range = "1H" | "1D" | "1W" | "1M" | "ALL";
const RANGES: Range[] = ["1H", "1D", "1W", "1M", "ALL"];

function rangeToDays(r: Range): number {
  switch (r) {
    case "1H":
      return 1;
    case "1D":
      return 2;
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "ALL":
      return 30;
  }
}

export function PriceChart({ history, currentPrice, className }: PriceChartProps) {
  const [range, setRange] = useState<Range>("1M");

  const data = useMemo(() => {
    const days = rangeToDays(range);
    return history.slice(-Math.min(days, history.length));
  }, [history, range]);

  const last24h = data[data.length - 1]?.yesPrice ?? currentPrice;
  const start24h = data[Math.max(0, data.length - 2)]?.yesPrice ?? currentPrice;
  const positive = last24h >= start24h;
  const color = positive ? "#00D982" : "#FF4757";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#5A6175]">
            YES Price
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className="text-4xl font-bold font-mono tabular-nums"
              style={{ color }}
            >
              {currentPrice}¢
            </span>
            <span
              className="font-mono text-sm tabular-nums"
              style={{ color }}
            >
              {positive ? "▲" : "▼"}{" "}
              {Math.abs(((last24h - start24h) / Math.max(1, start24h)) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-md border border-[#2A2F3D] bg-[#14161D]">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono font-semibold rounded-sm transition-colors",
                range === r
                  ? "bg-[#20232E] text-white shadow-[inset_0_0_0_1px_#353B4D]"
                  : "text-[#8B92A8] hover:text-white"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <ChartContainer height={280}>
        {({ width, height }) => (
          <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2F3D" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v) => format(parseISO(v), "MMM d")}
              stroke="#5A6175"
              fontSize={10}
              fontFamily="var(--font-mono)"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="#5A6175"
              fontSize={10}
              fontFamily="var(--font-mono)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}¢`}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#1A1D26",
                border: "1px solid #2A2F3D",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
              labelFormatter={(v) => format(parseISO(v as string), "MMM d, yyyy")}
              formatter={(v) => [`${v}¢`, "YES"]}
              labelStyle={{ color: "#8B92A8" }}
            />
            <ReferenceLine y={50} stroke="#353B4D" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="yesPrice"
              stroke={color}
              strokeWidth={2}
              fill="url(#chart-grad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
}
