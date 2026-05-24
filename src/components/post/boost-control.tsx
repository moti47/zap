"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Info } from "lucide-react";
import {
  BOOST_AMOUNTS,
  BOOST_DURATIONS_H,
  type BoostAmount,
  type BoostDurationH,
} from "@/lib/exposure";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ZapMark } from "../zap-logo";
import { cn } from "@/lib/utils";

interface BoostControlProps {
  enabled: boolean;
  amount: BoostAmount;
  durationH: BoostDurationH;
  balance: number;
  onToggle: (next: boolean) => void;
  onAmountChange: (amount: BoostAmount) => void;
  onDurationChange: (durationH: BoostDurationH) => void;
}

export function BoostControl({
  enabled,
  amount,
  durationH,
  balance,
  onToggle,
  onAmountChange,
  onDurationChange,
}: BoostControlProps) {
  const insufficient = amount > balance;

  const estimatedReach = useMemo(() => {
    // Rough demo curve: amount * duration * lift constant.
    const lift = Math.log(amount) / Math.log(1500);
    const hoursAdj = Math.min(1, durationH / 12);
    return Math.round(800 + lift * 4000 + lift * 2000 * hoursAdj);
  }, [amount, durationH]);

  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        enabled
          ? "border-[#FFE600]/40 bg-[#FFE600]/5"
          : "border-[#2A2F3D] bg-transparent",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Rocket
          className={cn(
            "h-4 w-4",
            enabled ? "text-[#FFE600]" : "text-[#5A6175]",
          )}
        />
        <div className="text-[12px] font-mono uppercase tracking-widest text-[#8B92A8]">
          Boost
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="About boost"
              className="text-[#5A6175] hover:text-white"
            >
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 text-[12px] leading-relaxed text-[#C7CCD6]"
          >
            <div className="font-semibold text-white mb-1">How boost works</div>
            <p>
              Boost spends Zaps to amplify your post's exposure_score while the
              timer is active. Larger amounts and shorter windows produce a
              higher boost_factor.
            </p>
            <p className="mt-2 text-[#8B92A8]">
              Boost <em>never</em> overrides engagement throttling — if your
              post under-performs during the window, the boost is stopped
              early.
            </p>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <span
            className={cn(
              "text-[11px] font-mono",
              enabled ? "text-[#FFE600]" : "text-[#8B92A8]",
            )}
          >
            {enabled ? "ON" : "OFF"}
          </span>
          <span
            role="switch"
            aria-checked={enabled}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onToggle(!enabled);
              }
            }}
            onClick={() => onToggle(!enabled)}
            className={cn(
              "relative inline-flex h-5 w-9 rounded-full transition-colors",
              enabled ? "bg-[#FFE600]" : "bg-[#2A2F3D]",
            )}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 700, damping: 30 }}
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-[#0A0B0F]",
                enabled ? "left-[18px]" : "left-0.5",
              )}
            />
          </span>
        </label>
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Amount chips */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] mb-1.5">
                  Amount
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BOOST_AMOUNTS.map((a) => {
                    const active = amount === a;
                    const tooExpensive = a > balance;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => onAmountChange(a)}
                        disabled={tooExpensive}
                        className={cn(
                          "inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[12px] font-mono transition-colors",
                          active
                            ? "border-[#FFE600] bg-[#FFE600]/12 text-[#FFE600]"
                            : "border-[#2A2F3D] text-[#8B92A8] hover:text-white hover:border-[#353B4D]",
                          tooExpensive && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        {a}
                        <ZapMark />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] mb-1.5">
                  Duration
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BOOST_DURATIONS_H.map((h) => {
                    const active = durationH === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onDurationChange(h)}
                        className={cn(
                          "h-7 px-3 rounded-full border text-[12px] font-mono transition-colors",
                          active
                            ? "border-[#FFE600] bg-[#FFE600]/12 text-[#FFE600]"
                            : "border-[#2A2F3D] text-[#8B92A8] hover:text-white hover:border-[#353B4D]",
                        )}
                      >
                        {h}h
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estimate */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#5A6175]">Est. reach</span>
                <span className="text-white">~{estimatedReach.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono -mt-2">
                <span className="text-[#5A6175]">Cost</span>
                <span
                  className={cn(
                    insufficient ? "text-[#FF4757]" : "text-[#FFE600]",
                  )}
                >
                  {amount} <ZapMark /> {insufficient && "· insufficient"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
