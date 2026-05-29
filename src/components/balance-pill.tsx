"use client";

import { useViewer } from "@/lib/use-viewer";
import { useHydrated } from "@/lib/store";
import { ZapMark } from "./zap-logo";
import { cn } from "@/lib/utils";

/**
 * Authoritative Zap balance display.
 *
 *   - The ONLY source of truth is `viewer.zaps`, which `useViewer`
 *     selects from `public.profiles.zaps` and keeps in realtime sync
 *     through a per-row Postgres `UPDATE` channel filtered by
 *     `id=eq.${viewerId}`. Atomic quest payouts / trade settlements
 *     reflect here within one tick — no refresh required.
 *   - There is NO local-Zustand fallback. If the DB says the user has
 *     60 Zaps, the pill shows exactly "60 Zaps" — never a hardcoded
 *     bootstrap value, never a stale optimistic balance.
 *   - Renders nothing when no viewer is signed in (the topbar already
 *     gates this component behind `viewer && ...`, this is the
 *     belt-and-suspenders safety).
 *
 * Always renders "{n,nnn} Zaps" (NEVER $) per the platform's
 * internal-currency convention.
 */
interface BalancePillProps {
  variant?: "default" | "compact" | "stacked";
  className?: string;
}

export function BalancePill({
  variant = "default",
  className,
}: BalancePillProps) {
  const { viewer } = useViewer();
  const hydrated = useHydrated();

  // No viewer = no balance to show. Returning null prevents a "—" or
  // 0 from flashing for anonymous users in surfaces that forgot to
  // gate this component.
  if (hydrated && !viewer) return null;

  const zaps = viewer?.zaps ?? 0;
  const shown = hydrated && viewer ? zaps.toLocaleString() : "—";

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-sm font-bold num text-white",
          className,
        )}
        aria-label={`Balance: ${shown} Zaps`}
      >
        <ZapMark className="h-3.5 w-3.5" />
        {shown} Zaps
      </span>
    );
  }

  if (variant === "stacked") {
    return (
      <div
        className={cn(
          "rounded-md border border-[#FFB800]/20 bg-gradient-to-br from-[#1F1A0E] to-[#1A1D26] p-3",
          className,
        )}
        aria-label={`Balance: ${shown} Zaps`}
      >
        <div className="text-[10px] uppercase tracking-widest text-[#8B92A8] font-mono">
          Your Balance
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xl font-bold tracking-tight num text-white">
            {shown}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-[#FFE600] font-mono font-bold">
            Zaps
          </span>
          <ZapMark className="h-3.5 w-3.5" />
        </div>
      </div>
    );
  }

  // default — desktop topbar pill
  return (
    <div
      className={cn(
        "hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#2A2F3D] bg-[#14161D]",
        className,
      )}
      aria-label={`Balance: ${shown} Zaps`}
    >
      <span className="text-[10px] uppercase tracking-widest text-[#5A6175] font-mono">
        Balance
      </span>
      <span className="text-sm font-bold num text-white tabular-nums">
        {shown}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-[#FFE600] font-mono font-bold">
        Zaps
      </span>
      <ZapMark className="h-3.5 w-3.5" />
    </div>
  );
}
