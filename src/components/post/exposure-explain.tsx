"use client";

import { useMemo, useState } from "react";
import {
  Info,
  Rocket,
  Flame,
  Clock,
  Heart,
  User as UserIcon,
  Sparkles,
  Hash,
  Target,
  ThumbsDown,
  ThumbsUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { useZapStore } from "@/lib/store";
import { computeExposure } from "@/lib/exposure";
import { scorePost, sessionBucket, type PersonalizedBreakdown } from "@/lib/ranking";
import type { Post, User } from "@/lib/fixtures";
import type { UserPost } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ExposureExplainProps {
  post: Post | UserPost;
  author: User;
  category: string;
  /**
   * Phase 11+: when present, this is the *snapshot-time* personalized
   * breakdown — preferred because it shows exactly why the post ranked
   * where it ranked when the user opened the feed.
   */
  rankingBreakdown?: PersonalizedBreakdown;
  /**
   * Item #4 — when the explain panel is launched from the post 3-dots
   * context menu, the parent owns the open state and we render the
   * panel as a centered Dialog instead of a popover. The Info-button
   * trigger is suppressed in this mode.
   */
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
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

export function ExposureExplain({
  post,
  author,
  category,
  rankingBreakdown,
  controlledOpen,
  onOpenChange,
  hideTrigger,
}: ExposureExplainProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  const affinity = useZapStore((s) => s.affinity[category] ?? 0.3);
  const affinityGraph = useZapStore((s) => s.affinityGraph);
  const sessionState = useZapStore((s) => s.session);
  const storeApplySignal = useZapStore((s) => s.applySignal);
  const impressionsFromStore = useZapStore(
    (s) => s.postImpressions[post.id] ?? 0,
  );
  const cooldownEndsAt = useZapStore((s) => s.cooldownEndsAt);
  const cooldownActive = !!cooldownEndsAt && new Date(cooldownEndsAt) > new Date();

  // Prefer the snapshot-time breakdown. Recompute live as a fallback so
  // the popover still works for posts not in a snapshot.
  const personalized = useMemo<PersonalizedBreakdown>(() => {
    if (rankingBreakdown) return rankingBreakdown;
    const userPost = (post as UserPost).type === "user" ? (post as UserPost) : null;
    const impressions =
      userPost?.impressions ?? impressionsFromStore ?? Math.max(20, post.views ?? 0);
    const expertPct =
      (author.expertScores[category as keyof typeof author.expertScores] ?? 50) /
      100;
    return scorePost(
      {
        id: post.id,
        createdAt: post.createdAt,
        authorId: author.id,
        category,
        hashtags: [],
        contentFormat: (post as any).images?.length
          ? "image"
          : ((post as any).body?.length ?? 0) > 280
            ? "long_form"
            : "short",
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        impressions,
        expertPercentile: expertPct,
        boostZaps: userPost?.boostZaps,
        boostUntil: userPost?.boostUntil ?? null,
        authorCooldown: cooldownActive && !!userPost,
        throttled: userPost?.throttled,
      },
      affinityGraph,
      sessionState,
    );
  }, [
    rankingBreakdown,
    post,
    author,
    category,
    impressionsFromStore,
    cooldownActive,
    affinityGraph,
    sessionState,
  ]);

  // Legacy publisher-side exposure (kept for reference in the popover).
  const legacy = useMemo(() => {
    const expertPct =
      (author.expertScores[category as keyof typeof author.expertScores] ?? 50) /
      100;
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
      key: "personal",
      label: "Personal match",
      weight: 0.62,
      value: personalized.personalizedMatch,
      icon: <Sparkles className="h-3 w-3" />,
      color: "#FFE600",
      description: "Your multi-layer affinity (category × author × style × hashtag)",
    },
    {
      key: "expert",
      label: "Expert factor",
      weight: 0.18,
      value: personalized.expertFactor,
      icon: <Flame className="h-3 w-3" />,
      color: "#FFB800",
      description: `${author.name}'s percentile in ${category}`,
    },
    {
      key: "engagement",
      label: "Engagement",
      weight: 0.10,
      value: personalized.engagementFactor,
      icon: <Heart className="h-3 w-3" />,
      color: "#FF4757",
      description: "Likes / comments / shares vs impressions",
    },
    {
      key: "freshness",
      label: "Freshness",
      weight: 0.07,
      value: personalized.freshnessFactor,
      icon: <Clock className="h-3 w-3" />,
      color: "#36D399",
      description: "Decays over a ~12h half-life",
    },
    {
      key: "boost",
      label: "Boost",
      weight: 0.03,
      value: personalized.boostFactor,
      icon: <Rocket className="h-3 w-3" />,
      color: "#A855F7",
      description:
        personalized.boostFactor > 0
          ? "Author is currently boosting this post"
          : "No active boost",
    },
  ];

  // Top-3 strongest match contributions for the "Shown because:" line.
  const topReasons = personalized.topReasons;
  const bucket = sessionBucket();

  const body = (
    <>
        <div className="px-4 py-3 border-b border-[#2A2F3D] flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">Why am I seeing this?</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 w-24 rounded-full bg-[#0E1016] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FFE600]"
                  style={{ width: `${Math.round(personalized.finalScore * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-[#8B92A8]">
                {Math.round(personalized.finalScore * 100)}% match
              </span>
            </div>
          </div>
          <div
            className={cn(
              "text-[10px] font-mono px-2 py-1 rounded-full border",
              personalized.throttled
                ? "border-[#FF4757]/40 text-[#FF4757] bg-[#FF4757]/10"
                : "border-[#FFE600]/40 text-[#FFE600] bg-[#FFE600]/10",
            )}
          >
            {personalized.throttled ? "throttled" : "ranked"}
          </div>
        </div>

        {topReasons.length > 0 && (
          <div className="px-4 py-2.5 border-b border-[#2A2F3D] bg-[#0E1016]/60">
            <div className="text-[10px] uppercase tracking-widest text-[#5A6175] mb-1.5">
              Shown because
            </div>
            <ul className="space-y-0.5">
              {topReasons.map((r, i) => (
                <li
                  key={`${r.layer}-${r.key}-${i}`}
                  className="flex items-center gap-1.5 text-[11px] text-white"
                >
                  {r.layer === "categories" ? (
                    <Target className="h-3 w-3 text-[#FFE600]" />
                  ) : r.layer === "authors" ? (
                    <UserIcon className="h-3 w-3 text-[#4DA3FF]" />
                  ) : r.layer === "hashtags" ? (
                    <Hash className="h-3 w-3 text-[#36D399]" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-[#A855F7]" />
                  )}
                  <span className="font-mono text-[10.5px] text-[#8B92A8]">
                    {r.layer}.{r.key}
                  </span>
                  <span className="flex-1" />
                  <span
                    className="text-[10px] font-mono"
                    style={{
                      color: r.value >= 0.6 ? "#36D399" : r.value >= 0.35 ? "#FFE600" : "#5A6175",
                    }}
                  >
                    {r.value.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
          {personalized.cooldownPenalty > 0 && (
            <div className="text-[10.5px] text-[#FF4757] font-mono pt-1 border-t border-[#2A2F3D]">
              −{personalized.cooldownPenalty.toFixed(2)} cooldown penalty (3 throttles in 7d)
            </div>
          )}

          {/* Debug toggle */}
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-mono text-[#5A6175] hover:text-[#8B92A8] transition-colors pt-1 border-t border-[#2A2F3D]"
          >
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", debugOpen && "rotate-180")}
            />
            Debug details
          </button>
          {debugOpen && (
            <div className="text-[10px] font-mono text-[#5A6175] space-y-0.5">
              <div>final_score: {personalized.finalScore.toFixed(4)}</div>
              <div>legacy: {legacy.score.toFixed(4)}</div>
              <div>session: {bucket}</div>
            </div>
          )}
        </div>

        {/* Tune actions */}
        <div className="px-3 py-3 border-t border-[#2A2F3D] flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              storeApplySignal("hide_post", {
                category,
                authorId: author.id,
              });
              toast.success(`Less ${category} in your feed`);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md border border-[#2A2F3D] text-[11.5px] font-mono text-[#8B92A8] hover:border-[#FF4757]/50 hover:text-[#FF4757] transition-colors"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Not interested
          </button>
          <button
            type="button"
            onClick={() => {
              storeApplySignal("like", {
                category,
                authorId: author.id,
              });
              toast.success(`More ${category} coming up`);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md border border-[#2A2F3D] text-[11.5px] font-mono text-[#8B92A8] hover:border-[#36D399]/50 hover:text-[#36D399] transition-colors"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            See more
          </button>
        </div>
    </>
  );

  // Item #4 — Controlled dialog mode (launched from the post 3-dots menu).
  if (controlledOpen !== undefined) {
    return (
      <Dialog open={controlledOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden text-[12px]">
          <DialogTitle className="sr-only">Why am I seeing this?</DialogTitle>
          <DialogDescription className="sr-only">
            Explanation of the ranking factors that surfaced this post in your feed.
          </DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  // Default popover mode (back-compat for any callers still using the
  // inline Info-button trigger).
  if (hideTrigger) return null;
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
        className="w-[360px] p-0 overflow-hidden text-[12px]"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
