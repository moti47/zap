"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Tiny dependency-free confetti burst. Fires when `trigger` increments
 * (use `useState(0)` + setN(n=>n+1) on the claim moment).
 *
 * Section 25 — satisfying claim states. Visible but not noisy: 18
 * particles, ~1.4s lifetime, prefers reduced motion when set.
 */
export function Confetti({
  trigger,
  origin = "center",
  colors = ["#FFE600", "#FFB800", "#36D399", "#4DA3FF", "#FF6FB5"],
}: {
  trigger: number;
  origin?: "center" | "top" | "bottom";
  colors?: string[];
}) {
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    if (trigger <= 0) return;
    if (typeof window !== "undefined") {
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (prefersReduced) return;
    }
    const id = Date.now();
    setBursts((prev) => [...prev, id]);
    const t = setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b !== id));
    }, 1600);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {bursts.map((id) => (
          <BurstFrame key={id} colors={colors} origin={origin} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function BurstFrame({
  colors,
  origin,
}: {
  colors: string[];
  origin: "center" | "top" | "bottom";
}) {
  const startY = origin === "top" ? "0%" : origin === "bottom" ? "100%" : "50%";
  return (
    <>
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const radius = 80 + Math.random() * 40;
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius - 30;
        const color = colors[i % colors.length];
        const size = 4 + Math.random() * 4;
        const rotation = Math.random() * 360;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{
              x: dx,
              y: dy + 40, // gravity
              opacity: 0,
              rotate: rotation,
              scale: 1,
            }}
            transition={{ duration: 1.2 + Math.random() * 0.3, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: "50%",
              top: startY,
              width: size,
              height: size,
              background: color,
              borderRadius: i % 2 ? 1 : 999,
              boxShadow: `0 0 6px ${color}`,
              translateX: "-50%",
              translateY: "-50%",
            }}
          />
        );
      })}
    </>
  );
}
