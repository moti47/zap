"use client";

import { useId } from "react";

interface SparklineProps {
  data: { yesPrice: number }[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  positive = true,
  width = 110,
  height = 38,
  className,
}: SparklineProps) {
  const rawId = useId();
  // Sanitize the React id (which contains ":") into something valid for url(#…)
  const gradId = `spark-grad-${rawId.replace(/[:]/g, "")}`;
  if (!data || data.length === 0) return null;
  const values = data.map((d) => d.yesPrice);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, data.length - 1);

  const pts = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d.yesPrice - min) / range) * (height - 4) - 2;
    return [x, y];
  });

  const line = pts
    .map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`))
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const color = positive ? "#00D982" : "#FF4757";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width, height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
