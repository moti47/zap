"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ZapMark } from "../zap-logo";

interface PriceDisplayProps {
  label: "YES" | "NO";
  price: number;
  delta?: number;
  flash?: "up" | "down" | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PriceDisplay({
  label,
  price,
  delta,
  flash,
  size = "md",
  className,
}: PriceDisplayProps) {
  const isYes = label === "YES";
  const sizeMap = {
    sm: { num: "text-base", lbl: "text-[9px]", delta: "text-[10px]" },
    md: { num: "text-[22px]", lbl: "text-[10px]", delta: "text-[11px]" },
    lg: { num: "text-4xl", lbl: "text-xs", delta: "text-sm" },
  };
  const s = sizeMap[size];
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "font-mono uppercase tracking-wider text-[#5A6175]",
          s.lbl
        )}
      >
        {label}
      </span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={price}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "font-mono font-semibold leading-none tabular-nums tracking-tight inline-flex items-baseline",
            s.num,
            isYes ? "text-[#00D982]" : "text-[#FF4757]",
            flash === "up" && "animate-[flash-up_0.7s_ease-out]",
            flash === "down" && "animate-[flash-down_0.7s_ease-out]"
          )}
        >
          {price}
          <ZapMark className="ml-0.5" />
        </motion.span>
      </AnimatePresence>
      {delta !== undefined && (
        <span
          className={cn(
            "font-mono tabular-nums",
            s.delta,
            delta >= 0 ? "text-[#00D982]" : "text-[#FF4757]"
          )}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
