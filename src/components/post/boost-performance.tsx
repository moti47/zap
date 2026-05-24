"use client";

import { useEffect, useState } from "react";
import { Rocket, AlertTriangle, Eye, MousePointerClick, Heart } from "lucide-react";
import { ZapMark } from "../zap-logo";
import type { UserPost } from "@/lib/store";
import { cn } from "@/lib/utils";

interface BoostPerformanceProps {
  post: UserPost;
}

function fmtRemaining(until: string | null | undefined, now: number): string {
  if (!until) return "—";
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return "ended";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m left`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

export function BoostPerformance({ post }: BoostPerformanceProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const active = !!post.boostUntil && new Date(post.boostUntil).getTime() > now;
  const earlyStopped = !!post.boostEarlyStoppedAt;
  // If neither active nor early-stopped, hide.
  if (!active && !earlyStopped && !post.boostZaps) return null;

  const impressions = post.impressions ?? 0;
  const clicks = post.clicks ?? 0;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const engagements = post.likes + post.comments + post.shares;
  const engRate = impressions > 0 ? engagements / impressions : 0;
  const remaining = fmtRemaining(post.boostUntil, now);

  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2.5",
        earlyStopped
          ? "border-[#FF4757]/40 bg-[#FF4757]/8"
          : active
          ? "border-[#FFE600]/40 bg-[#FFE600]/6"
          : "border-[#2A2F3D] bg-[#0E1016]",
      )}
    >
      <div className="flex items-center gap-2">
        <Rocket
          className={cn(
            "h-3.5 w-3.5",
            earlyStopped ? "text-[#FF4757]" : "text-[#FFE600]",
          )}
        />
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#8B92A8]">
          Boost performance
        </div>
        <span className="flex-1" />
        <span
          className={cn(
            "text-[10px] font-mono",
            active ? "text-[#FFE600]" : "text-[#5A6175]",
          )}
        >
          {post.boostZaps ?? 0}
          <ZapMark />
        </span>
        <span className="text-[10px] font-mono text-[#8B92A8]">{remaining}</span>
      </div>

      {earlyStopped && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#FF4757]">
          <AlertTriangle className="h-3 w-3" />
          Boost stopped early — engagement was below threshold within 1h.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <Stat
          label="Impressions"
          value={impressions.toLocaleString()}
          icon={<Eye className="h-3 w-3" />}
        />
        <Stat
          label="CTR"
          value={`${(ctr * 100).toFixed(1)}%`}
          icon={<MousePointerClick className="h-3 w-3" />}
        />
        <Stat
          label="Eng. rate"
          value={`${(engRate * 100).toFixed(1)}%`}
          icon={<Heart className="h-3 w-3" />}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded border border-[#2A2F3D] bg-[#0A0B0F] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9.5px] font-mono uppercase tracking-widest text-[#5A6175]">
        {icon}
        {label}
      </div>
      <div className="text-[14px] font-mono text-white mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
