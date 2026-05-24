"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Heart,
  Share2,
  Bookmark,
  MoreHorizontal,
  Flame,
  Rocket,
} from "lucide-react";
import { UserAvatar } from "../user-avatar";
import { ExpertBadge, CategoryTag } from "../expert-badge";
import { MarketCardCompact } from "../market/market-card-compact";
import { ZapMark } from "../zap-logo";
import { Badge } from "../ui/badge";
import { CommentThread } from "./comment-thread";
import { ExposureExplain } from "./exposure-explain";
import { BoostPerformance } from "./boost-performance";
import { toast } from "sonner";
import { useZapStore, type UserPost } from "@/lib/store";
import { currentUser, getMarket, getUser, type Post } from "@/lib/mock-data";
import { cn, timeAgo, formatLargeNumber } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { SellSheet } from "../market/sell-sheet";

interface PostCardProps {
  post: Post | UserPost;
  isNew?: boolean;
  defaultThreadOpen?: boolean;
}

function isUserPost(p: Post | UserPost): p is UserPost {
  return p.type === "user";
}

export function PostCard({ post, isNew = false, defaultThreadOpen = false }: PostCardProps) {
  const isMineFlag = isUserPost(post);
  const user = isMineFlag ? currentUser : getUser(post.userId);
  const liked = useZapStore((s) => s.likedPostIds.includes(post.id));
  const bookmarked = useZapStore((s) => s.bookmarkedPostIds.includes(post.id));
  const toggleLike = useZapStore((s) => s.toggleLike);
  const toggleBookmark = useZapStore((s) => s.toggleBookmarkPost);
  const userComments = useZapStore((s) => s.commentsByPostId[post.id]);
  const recordImpression = useZapStore((s) => s.recordImpression);
  const recordClick = useZapStore((s) => s.recordClick);
  const bumpAffinity = useZapStore((s) => s.bumpAffinity);
  const applyThrottleCheck = useZapStore((s) => s.applyThrottleCheck);

  const [threadOpen, setThreadOpen] = useState(defaultThreadOpen);
  const [floatHeart, setFloatHeart] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const articleRef = useRef<HTMLElement>(null);
  const impressionLoggedRef = useRef(false);
  const dwellStartRef = useRef<number | null>(null);

  // Track impression once the card is ≥50% visible.
  useEffect(() => {
    const el = articleRef.current;
    if (!el || impressionLoggedRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressionLoggedRef.current) {
            impressionLoggedRef.current = true;
            recordImpression(post.id);
            dwellStartRef.current = Date.now();
          }
          if (!entry.isIntersecting && dwellStartRef.current && isMineFlag) {
            // Throttle check fires when the author's own post scrolls past — cheap demo trigger.
            applyThrottleCheck(post.id);
          }
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.id, isMineFlag, recordImpression, applyThrottleCheck]);

  if (!user) return null;

  const market = "marketId" in post && post.marketId ? getMarket(post.marketId) : null;
  const category = "category" in post ? post.category : undefined;
  const isLaunch = post.type === "launch";
  const isPrediction = post.type === "prediction";
  const explainCategory =
    (category as string | undefined) ?? market?.category ?? user.primaryCategory;
  const userPost = isMineFlag ? (post as UserPost) : null;
  const boostActive =
    !!userPost?.boostUntil && new Date(userPost.boostUntil).getTime() > Date.now();

  const handleLike = () => {
    if (!liked) {
      setFloatHeart(true);
      setTimeout(() => setFloatHeart(false), 700);
      if (explainCategory) bumpAffinity(explainCategory, "like");
    }
    toggleLike(post.id);
  };

  const handleClickThrough = () => {
    recordClick(post.id);
    if (explainCategory) bumpAffinity(explainCategory, "click");
  };

  // Live comment count = seeded engagement count + locally added
  const liveComments =
    (post.comments ?? 0) + (userComments?.length ?? 0);

  return (
    <motion.article
      ref={articleRef as any}
      initial={isNew ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative rounded-[14px] border p-5 transition-all hover:border-[#353B4D]",
        isLaunch
          ? "border-[#FFB800]/25 bg-gradient-to-br from-[#1F1A0E] to-[#1A1D26]"
          : boostActive
          ? "border-[#FFE600]/30 bg-[#1A1D26]"
          : "border-[#2A2F3D] bg-[#1A1D26]"
      )}
    >
      {boostActive && (
        <div className="absolute -top-2 left-4 inline-flex items-center gap-1 bg-[#FFE600] text-[#0A0B0F] text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded">
          <Rocket className="h-2.5 w-2.5" />
          Boosted
        </div>
      )}
      {isLaunch && (
        <>
          <div
            className="absolute inset-0 rounded-[14px] pointer-events-none"
            style={{
              background:
                "radial-gradient(400px 200px at 90% 0%, rgba(255, 184, 0, 0.08), transparent 60%)",
            }}
          />
          <div className="relative flex items-center gap-2 flex-wrap mb-3">
            <Badge variant="new">
              <Flame className="h-3 w-3" /> New market
            </Badge>
            <span className="text-[11px] font-mono text-[#5A6175]">
              Just launched · {timeAgo(post.createdAt)} ago
            </span>
            {market && (
              <span className="ml-auto">
                <CategoryTag category={market.category} />
              </span>
            )}
          </div>
        </>
      )}

      {/* Author row */}
      <div className="flex items-center gap-3 relative">
        <Link href={isMineFlag ? "/profile/you" : `/profile/${user.username}`}>
          <UserAvatar
            src={user.avatarUrl}
            name={user.name}
            category={user.primaryCategory}
            score={user.expertScores[user.primaryCategory]}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={isMineFlag ? "/profile/you" : `/profile/${user.username}`}
              className="font-semibold text-[14.5px] hover:text-[#FFE600] transition-colors"
            >
              {user.name}
            </Link>
            {user.verified && (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-[#FFE600]"
              >
                <path d="M12 2l2.4 2.2 3.2-.4.9 3.1 3 1.3-1.1 3.1 1.4 2.9-2.8 1.7-.4 3.2-3.2.4-2 2.5-2.8-1.5-3 .9-1.3-3-3.1-1 1-3-1.6-2.8 2.6-2 .6-3.1 3.2-.2L12 2zm-1.2 13.4l5.6-5.6-1.4-1.4-4.2 4.2-2-2-1.4 1.4 3.4 3.4z" />
              </svg>
            )}
            {isMineFlag && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 px-1.5 py-0.5 rounded">
                You
              </span>
            )}
            <ExpertBadge
              category={user.primaryCategory}
              score={user.expertScores[user.primaryCategory] ?? 50}
            />
            {isPrediction && (
              <span className="text-[12px] font-mono text-[#5A6175]">
                made a prediction
              </span>
            )}
            {category && !isPrediction && !isLaunch && (
              <CategoryTag category={category} />
            )}
          </div>
          <div className="text-xs font-mono text-[#5A6175] mt-0.5">
            <span className="text-[#8B92A8]">@{user.username}</span> ·{" "}
            {timeAgo(post.createdAt)}
            {isPrediction
              ? ` · staked ${(post as any).staked}⚡`
              : ` · ${formatLargeNumber(post.views)} views`}
          </div>
        </div>
        <ExposureExplain post={post} author={user} category={explainCategory} />
        <button className="text-[#5A6175] hover:text-white p-1.5" aria-label="More">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {post.body && (
        isUserPost(post) && /<[a-z][\s\S]*>/i.test(post.body) ? (
          <div
            className="rich-body text-[15px] leading-[1.55] mt-3.5 mb-2.5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[#FFE600] [&_blockquote]:pl-3 [&_blockquote]:text-[#8B92A8] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#FFE600] [&_a]:underline [&_pre]:font-mono [&_pre]:bg-[#0E1016] [&_pre]:px-2 [&_pre]:py-1 [&_pre]:rounded [&_img]:max-h-[300px] [&_img]:rounded [&_img]:my-1"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
          />
        ) : (
          <p className="text-[15px] leading-[1.55] mt-3.5 mb-2.5 whitespace-pre-wrap">
            {post.body}
          </p>
        )
      )}

      {/* User-uploaded images grid */}
      {isMineFlag && post.images && post.images.length > 0 && (
        <div
          className={cn(
            "mt-2 grid gap-2 rounded-md overflow-hidden",
            post.images.length === 1 && "grid-cols-1",
            post.images.length === 2 && "grid-cols-2",
            post.images.length >= 3 && "grid-cols-2 sm:grid-cols-2"
          )}
        >
          {post.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className={cn(
                "w-full object-cover rounded-md border border-[#2A2F3D]",
                post.images!.length === 1 ? "max-h-[440px]" : "aspect-[4/3]"
              )}
            />
          ))}
        </div>
      )}

      {/* Prediction position tag */}
      {isPrediction && (
        <button
          type="button"
          onClick={() => setSellOpen(true)}
          aria-label="Open sell sheet for this position"
          className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full font-mono text-[11.5px] border mt-1 hover:opacity-90 transition-opacity",
            (post as any).side === "YES"
              ? "border-[#00D982]/35 bg-[#00D982]/12 text-[#00D982]"
              : "border-[#FF4757]/35 bg-[#FF4757]/12 text-[#FF4757]"
          )}
        >
          {(post as any).side === "YES" ? "▲" : "▼"} Holds {(post as any).shares}{" "}
          {(post as any).side} @ {(post as any).avgPrice}
          <ZapMark />
          {(post as any).pnl !== undefined && (
            <span className="text-[#8B92A8]">
              · {(post as any).pnl >= 0 ? "+" : ""}
              {(post as any).pnl.toFixed(2)}
              <ZapMark /> ({(post as any).pnlPct >= 0 ? "+" : ""}
              {(post as any).pnlPct}%)
            </span>
          )}
        </button>
      )}

      {/* Embedded market */}
      {market && (
        <div className="mt-3.5" onClick={handleClickThrough}>
          <MarketCardCompact market={market} />
        </div>
      )}

      {/* Phase 6 — author's own boost performance widget */}
      {userPost && (userPost.boostZaps || userPost.boostEarlyStoppedAt) && (
        <BoostPerformance post={userPost} />
      )}

      {/* Footer engagement */}
      <div className="flex items-center pt-3.5 mt-3.5 border-t border-[#2A2F3D] text-[#8B92A8]">
        <button
          onClick={() => setThreadOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 font-mono text-xs py-1.5 pr-4 transition-colors",
            threadOpen ? "text-[#FFE600]" : "hover:text-white"
          )}
        >
          <MessageCircle className="h-4 w-4" />
          {liveComments}
        </button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          className={cn(
            "inline-flex items-center gap-2 font-mono text-xs py-1.5 pr-4 transition-colors relative",
            liked ? "text-[#FF4757]" : "hover:text-white"
          )}
        >
          <motion.span
            animate={liked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut", times: [0, 0.5, 1] }}
            className="inline-flex"
          >
            <Heart className={cn("h-4 w-4", liked && "fill-[#FF4757]")} />
          </motion.span>
          {post.likes + (liked ? 1 : 0)}
          <AnimatePresence>
            {floatHeart && (
              <motion.span
                initial={{ y: 0, opacity: 1, scale: 0.5 }}
                animate={{ y: -28, opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.7 }}
                className="absolute left-0.5 top-0 text-[#FF4757]"
              >
                <Heart className="h-4 w-4 fill-[#FF4757]" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
        <button className="inline-flex items-center gap-2 font-mono text-xs py-1.5 pr-4 hover:text-white transition-colors">
          <Share2 className="h-4 w-4" />
          {post.shares}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark post"}
          aria-pressed={bookmarked}
          onClick={() => {
            toggleBookmark(post.id);
            toast.success(bookmarked ? "Removed from saved" : "Saved");
          }}
          className={cn(
            "p-1.5 transition-colors",
            bookmarked ? "text-[#FFE600]" : "text-[#5A6175] hover:text-white"
          )}
        >
          <Bookmark className={cn("h-4 w-4", bookmarked && "fill-[#FFE600]")} />
        </button>
      </div>

      <AnimatePresence>
        {threadOpen && (
          <CommentThread
            postId={post.id}
            postAuthorId={user.id}
            autoFocus
            onClose={() => setThreadOpen(false)}
          />
        )}
      </AnimatePresence>

      {isPrediction && market && (
        <SellSheet
          open={sellOpen}
          onOpenChange={setSellOpen}
          marketId={market.id}
          initialSide={(post as any).side}
        />
      )}
    </motion.article>
  );
}
