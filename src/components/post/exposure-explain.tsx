"use client";

import { useMemo } from "react";
import { Info, Rocket, Flame, Clock, Heart, User as UserIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useZapStore } from "@/lib/store";
import { computeExposure } from "@/lib/exposure";
import type { Post, User } from "@/lib/mock-data";
import type { UserPost } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ExposureExplainProps {
  post: Post | UserPost;
  author: User;
  category: string;
}

interface Row {
  key: string;
  label: string;
  weight: number;
  value: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export function ExposureExplain({ post, author, category }: ExposureExplainProps) {
  const affinity = useZapStore((s) => s.affinity[category] ?? 0.3);
  const impressionsFromStore = useZapStore(
    (s) => s.postImpressions[post.id] ?? 0,
  );
  const cooldownEndsAt = useZapStore((s) => s.cooldownEndsAt);
  const cooldownActive = !!cooldownEndsAt && new Date(cooldownEndsAt) > new Date();

  const breakdown = useMemo(() => {
    const expertPct = (author.expertScores[category as keyof typeof author.expertScores] ?? 50) / 100;
    const userPost = (post as UserPost).type === "user" ? (post as UserPost) : null;
    const impressions =
      userPost?.impressions ?? impressionsFromStore ?? Math.max(20, post.views ?? 0);
    return computeExposure({
      expertScore: expertPct,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      impressions,
      createdAt: post.createdAt,
      categoryAffinity: affinity,
      boostZaps: userPost?.boostZaps,
      boostUntil: userPost?.boostUntil ?? null,
      throttled: userPost?.throttled,
      cooldownActive,
    });
  }, [post, author, category, affinity, impressionsFromStore, cooldownActive]);

  const rows: Row[] = [
    {
      key: "expert",
      label: "Expert factor",
      weight: 0.4,
      value: breakdown.expertFactor,
      icon: <Flame className="h-3 w-3" />,
      color: "#FFB800",
      description: `${author.name}'s percentile in ${category}`,
    },
    {
      key: "engagement",
      label: "Engagement",
      weight: 0.25,
      value: breakdown.engagementFactor,
      icon: <Heart className="h-3 w-3" />,
      color: "#FF4757",
      description: "Likes / comments / shares vs impressions",
    },
    {
      key: "freshness",
      label: "Freshness",
      weight: 0.15,
      value: breakdown.freshnessFactor,
      icon: <Clock className="h-3 w-3" />,
      color: "#36D399",
      description: "Decays over a ~12h half-life",
    },
    {
      key: "affinity",
      label: "Your affinity",
      weight: 0.1,
      value: breakdown.affinityFactor,
      icon: <UserIcon className="h-3 w-3" />,
      color: "#4DA3FF",
      description: `Built from your clicks, dwell time, likes & follows in ${category}`,
    },
    {
      key: "boost",
      label: "Boost",
      weight: 0.1,
      value: breakdown.boostFactor,
      icon: <Rocket className="h-3 w-3" />,
      color: "#FFE600",
      description:
        breakdown.boostFactor > 0
          ? "Author is currently boosting this post"
          : "No active boost",
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Why am I seeing this?"
          className="text-[#5A6175] hover:text-[#FFE600] transition-colors p-1"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[320px] p-0 overflow-hidden text-[12px]"
      >
        <div className="px-4 py-3 border-b border-[#2A2F3D] flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">Why am I seeing this?</div>
            <div className="text-[10px] font-mono text-[#5A6175] mt-0.5">
              exposure_score = {breakdown.score.toFixed(3)}
            </div>
          </div>
          <div
            className={cn(
              "text-[10px] font-mono px-2 py-1 rounded-full border",
              breakdown.throttled
                ? "border-[#FF4757]/40 text-[#FF4757] bg-[#FF4757]/10"
                : "border-[#FFE600]/40 text-[#FFE600] bg-[#FFE600]/10",
            )}
          >
            {breakdown.throttled ? "throttled" : "ranked"}
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          {rows.map((r) => {
            const contribution = r.weight * r.value;
            return (
              <div key={r.key}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: r.color }}>{r.icon}</span>
                  <span className="font-mono text-[11px] text-white">{r.label}</span>
                  <span className="text-[10px] font-mono text-[#5A6175]">
                    ×{r.weight.toFixed(2)}
                  </span>
                  <span className="flex-1" />
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: r.color }}
                  >
                    +{contribution.toFixed(3)}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-[#0E1016] overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.round(r.value * 100)}%`,
                      background: r.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <div className="text-[10.5px] text-[#8B92A8] mt-1 leading-snug">
                  {r.description}
                </div>
              </div>
            );
          })}
          {breakdown.cooldownActive && (
            <div className="text-[10.5px] text-[#FF4757] font-mono pt-1 border-t border-[#2A2F3D]">
              -0.30 cooldown penalty (3 throttles in 7d)
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
