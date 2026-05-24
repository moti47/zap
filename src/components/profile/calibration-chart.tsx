"use client";

import dynamic from "next/dynamic";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { User } from "@/lib/mock-data";
import { ChartContainer } from "../market/chart-container";

const ComposedChart = dynamic(
  () => import("recharts").then((m) => m.ComposedChart),
  { ssr: false }
) as any;

interface CalibrationChartProps {
  user: User;
}

export function CalibrationChart({ user }: CalibrationChartProps) {
  const data = user.calibration.map((c) => ({
    predicted: c.predicted,
    actual: c.actual,
    count: c.count,
    wellCalibrated: Math.abs(c.predicted - c.actual) <= 5,
  }));

  const totalPredictions = data.reduce((a, b) => a + b.count, 0);
  const wellCalibratedBuckets = data.filter((d) => d.wellCalibrated).length;

  const sample = data.reduce(
    (best, d) => (d.count > (best?.count ?? 0) ? d : best),
    data[0]
  );

  return (
    <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-base font-semibold">Calibration</h3>
        <span className="text-[11px] font-mono text-[#5A6175]">
          {totalPredictions.toLocaleString()} resolved · {wellCalibratedBuckets}/10 well-calibrated
        </span>
      </div>
      <p className="text-sm text-[#8B92A8] mb-4">
        When <span className="text-white font-semibold">{user.name.split(" ")[0]}</span> predicts{" "}
        <span className="text-[#FFE600] font-mono">{sample.predicted}%</span>, the actual rate is{" "}
        <span className="text-[#FFE600] font-mono">{sample.actual}%</span> —{" "}
        {Math.abs(sample.predicted - sample.actual) <= 5
          ? "well calibrated."
          : sample.predicted > sample.actual
          ? "slightly overconfident."
          : "slightly underconfident."}
      </p>
      <ChartContainer height={300}>
        {({ width, height }) => (
          <ComposedChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 16, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2F3D" />
            <XAxis
              dataKey="predicted"
              domain={[0, 100]}
              type="number"
              stroke="#5A6175"
              fontSize={10}
              fontFamily="var(--font-mono)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: "Predicted probability",
                position: "insideBottom",
                offset: -5,
                fill: "#5A6175",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            />
            <YAxis
              dataKey="actual"
              domain={[0, 100]}
              stroke="#5A6175"
              fontSize={10}
              fontFamily="var(--font-mono)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: "Actual",
                angle: -90,
                position: "insideLeft",
                fill: "#5A6175",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            />
            <Tooltip
              contentStyle={{
                background: "#1A1D26",
                border: "1px solid #2A2F3D",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              labelStyle={{ color: "#8B92A8" }}
              formatter={(v: any, name: any, item: any) => {
                if (name === "actual")
                  return [`${item.payload.actual}%`, "Actual rate"];
                return [`${v}`, String(name ?? "")];
              }}
              labelFormatter={(v) => `Predicted ${v}%`}
            />
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: 100, y: 100 },
              ]}
              stroke="#FFE600"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              ifOverflow="extendDomain"
            />
            <Line
              dataKey="actual"
              type="monotone"
              stroke="#00D982"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const overConfident = payload.predicted > payload.actual + 5;
                const color = payload.wellCalibrated
                  ? "#00D982"
                  : overConfident
                  ? "#FF4757"
                  : "#FFB800";
                return (
                  <circle
                    key={`dot-${props.index}`}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={color}
                    stroke="#0A0B0F"
                    strokeWidth={2}
                  />
                );
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        )}
      </ChartContainer>
      <div className="mt-4 flex gap-4 text-[11px] font-mono justify-center flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00D982]" /> Well-calibrated (±5%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FFB800]" /> Underconfident
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FF4757]" /> Overconfident
        </span>
      </div>
    </div>
  );
}
