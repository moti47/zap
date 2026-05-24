"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Heart } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { UserAvatar } from "../user-avatar";
import { ExpertBadge, LivePulseDot } from "../expert-badge";
import { ZapMark } from "../zap-logo";
import { MarketCardCompact } from "./market-card-compact";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useZapStore } from "@/lib/store";
import {
  getMarket,
  getUser,
  relatedMarkets,
  type Market,
  commentsForMarket,
} from "@/lib/mock-data";
import { timeAgo, cn, formatLargeNumber } from "@/lib/utils";

interface MarketTabsProps {
  market: Market;
}

export function MarketTabs({ market }: MarketTabsProps) {
  const allTrades = useZapStore(useShallow((s) => s.recentTrades));
  const userComments = useZapStore(
    useShallow((s) => s.commentsByPostId[`market-${market.id}`] ?? [])
  );
  const likedCommentIds = useZapStore(
    useShallow((s) => s.likedCommentIds)
  );
  const addComment = useZapStore((s) => s.addComment);
  const toggleCommentLike = useZapStore((s) => s.toggleCommentLike);

  const tradesForMarket = useMemo(() => {
    const matched = allTrades.filter((t) => t.marketId === market.id);
    return matched.length > 0 ? matched : allTrades.slice(0, 14);
  }, [allTrades, market.id]);

  const seededComments = useMemo(() => commentsForMarket(market.id), [market.id]);
  const related = useMemo(() => relatedMarkets(market.id, 4), [market.id]);

  const allComments = useMemo(() => {
    return [
      ...seededComments.map((c) => ({
        id: c.id,
        authorId: c.userId,
        body: c.body,
        createdAt: c.createdAt,
        likes: c.likes,
        position: c.position,
      })),
      ...userComments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        body: c.body,
        createdAt: c.createdAt,
        likes: c.likes,
        position: undefined,
      })),
    ];
  }, [seededComments, userComments]);

  const [body, setBody] = useState("");

  const submitComment = () => {
    if (!body.trim()) return;
    addComment(`market-${market.id}`, body.trim());
    toast.success("Comment posted");
    setBody("");
  };

  return (
    <Tabs defaultValue="activity" className="mt-6">
      <TabsList className="w-full md:w-auto">
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="comments">
          Comments{" "}
          <span className="text-[10px] font-mono text-[#5A6175] ml-1">
            {allComments.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="holders">Top Holders</TabsTrigger>
        <TabsTrigger value="related">Related</TabsTrigger>
      </TabsList>

      <TabsContent value="activity">
        <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2A2F3D] flex items-center justify-between">
            <h3 className="text-[13px] font-semibold flex items-center gap-2">
              <LivePulseDot /> Live Activity
            </h3>
            <span className="text-[11px] font-mono text-[#5A6175]">
              {tradesForMarket.length} recent trades
            </span>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {tradesForMarket.map((t) => {
              const u = getUser(t.userId);
              if (!u) return null;
              return (
                <motion.div
                  key={t.id}
                  initial={
                    t.isMine
                      ? { backgroundColor: "rgba(255,230,0,0.08)" }
                      : false
                  }
                  animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 1.5 }}
                  className="flex items-center gap-3 px-5 py-2.5 border-b border-[#2A2F3D] hover:bg-[#20232E]/30 transition-colors"
                >
                  <UserAvatar
                    src={u.avatarUrl}
                    name={u.name}
                    size="xs"
                    showScore={false}
                  />
                  <span className="text-sm font-medium truncate min-w-0">
                    {u.name}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs font-bold tabular-nums",
                      t.side === "YES" ? "text-[#00D982]" : "text-[#FF4757]"
                    )}
                  >
                    {t.side === "YES" ? "▲ Bought" : "▼ Bought"} {t.shares}{" "}
                    {t.side}
                  </span>
                  <span className="font-mono text-xs text-[#8B92A8] tabular-nums">
                    @ {t.price}
                    <ZapMark />
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-[#5A6175]">
                    {timeAgo(t.timestamp)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="comments">
        {/* Composer */}
        <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-4 flex gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] font-bold text-xs flex-shrink-0">
            Y
          </div>
          <div className="flex-1 min-w-0">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 500))}
              placeholder="Share your take on this market…"
              rows={2}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitComment();
              }}
            />
            <div className="flex items-center mt-2 gap-2">
              <span className="text-[10px] font-mono text-[#5A6175] tabular-nums">
                {body.length}/500
              </span>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={submitComment}
                disabled={!body.trim()}
                className="h-7"
              >
                <Send className="h-3 w-3" />
                Post comment
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {allComments.map((c) => {
            const u = getUser(c.authorId);
            if (!u) return null;
            const isMine = c.authorId === "u-current";
            const liked = likedCommentIds.includes(c.id);
            return (
              <div
                key={c.id}
                className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Link href={isMine ? "/profile/you" : `/profile/${u.username}`}>
                    <UserAvatar
                      src={u.avatarUrl}
                      name={u.name}
                      category={u.primaryCategory}
                      size="sm"
                      showScore={false}
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={isMine ? "/profile/you" : `/profile/${u.username}`}
                        className="text-sm font-semibold hover:text-[#FFE600]"
                      >
                        {u.name}
                      </Link>
                      <ExpertBadge
                        category={u.primaryCategory}
                        score={u.expertScores[u.primaryCategory] ?? 50}
                      />
                      {isMine && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                      {c.position && (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full font-mono text-[10px]",
                            c.position.side === "YES"
                              ? "bg-[#00D982]/10 text-[#00D982] border border-[#00D982]/35"
                              : "bg-[#FF4757]/10 text-[#FF4757] border border-[#FF4757]/35"
                          )}
                        >
                          {c.position.side === "YES" ? "▲" : "▼"}{" "}
                          {c.position.shares} {c.position.side} @{" "}
                          {c.position.avgPrice}
                          <ZapMark />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-[#5A6175]">
                      @{u.username} · {timeAgo(c.createdAt)}
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-[#E5E5E5] whitespace-pre-wrap">
                  {c.body}
                </p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#2A2F3D] text-[#8B92A8]">
                  <button
                    onClick={() => toggleCommentLike(c.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-mono transition-colors",
                      liked ? "text-[#FF4757]" : "hover:text-[#FF4757]"
                    )}
                  >
                    <Heart className={cn("h-3.5 w-3.5", liked && "fill-[#FF4757]")} />
                    {c.likes + (liked ? 1 : 0)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="holders">
        <div className="grid md:grid-cols-2 gap-4">
          <HoldersList
            title="YES Holders"
            holders={market.topHolders.yes}
            side="YES"
          />
          <HoldersList
            title="NO Holders"
            holders={market.topHolders.no}
            side="NO"
          />
        </div>
      </TabsContent>

      <TabsContent value="related">
        <div className="grid md:grid-cols-2 gap-4">
          {related.length > 0 ? (
            related.map((m) => <MarketCardCompact key={m.id} market={m} />)
          ) : (
            <p className="text-sm text-[#8B92A8]">No related markets yet.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function HoldersList({
  title,
  holders,
  side,
}: {
  title: string;
  holders: { userId: string; shares: number; avgPrice: number }[];
  side: "YES" | "NO";
}) {
  return (
    <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
      <div
        className={cn(
          "px-5 py-3 border-b border-[#2A2F3D]",
          side === "YES" ? "bg-[#00D982]/5" : "bg-[#FF4757]/5"
        )}
      >
        <h3
          className={cn(
            "text-[13px] font-semibold",
            side === "YES" ? "text-[#00D982]" : "text-[#FF4757]"
          )}
        >
          {title}
        </h3>
      </div>
      {holders.map((h, i) => {
        const u = getUser(h.userId);
        if (!u) return null;
        return (
          <Link
            key={h.userId}
            href={`/profile/${u.username}`}
            className="flex items-center gap-3 px-5 py-3 border-b border-[#2A2F3D] hover:bg-[#20232E]/40"
          >
            <span className="font-mono text-xs text-[#5A6175] w-5">{i + 1}</span>
            <UserAvatar
              src={u.avatarUrl}
              name={u.name}
              size="sm"
              category={u.primaryCategory}
              showScore={false}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{u.name}</div>
              <div className="text-[11px] font-mono text-[#5A6175]">
                avg {h.avgPrice}
                <ZapMark />
              </div>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {formatLargeNumber(h.shares)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
