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
  Info,
  Ban,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown";
import { UserAvatar } from "../user-avatar";
import { CategoryTag } from "../expert-badge";
import { MarketCardCompact } from "../market/market-card-compact";
import { ZapMark } from "../zap-logo";
import { Badge } from "../ui/badge";
import { CommentThread } from "./comment-thread";
import { ExposureExplain } from "./exposure-explain";
import { BoostPerformance } from "./boost-performance";
import { toast } from "sonner";
import { useZapStore, type UserPost } from "@/lib/store";
import { currentUser, getMarket, getUser, type Post } from "@/lib/fixtures";
import { useViewer } from "@/lib/use-viewer";
import { cn, categoryColor, formatLargeNumber } from "@/lib/utils";
import { TimeAgo } from "../ui/time-ago";
import { sanitizeHtml, linkifyHashtags } from "@/lib/sanitize";
import { linkifyMentions } from "@/lib/mentions";
import { SellSheet } from "../market/sell-sheet";
import { useRequireSignIn } from "@/lib/require-sign-in";
import {
  toggleLikeAction,
  toggleBookmarkAction,
} from "@/app/actions/social";
import { fireBumpQuest } from "@/lib/quest-bump";

import type { PersonalizedBreakdown } from "@/lib/ranking";

/**
 * Posts that came from Supabase have UUIDs. Posts that came from
 * fixtures or the local composer have ids like `p-…` or `up-…`.
 * The like/bookmark server actions only make sense for real UUIDs.
 */
function looksLikeServerPostId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

interface PostCardProps {
  post: Post | UserPost;
  isNew?: boolean;
  defaultThreadOpen?: boolean;
  /** Phase 11+: the ranking breakdown captured at snapshot time. */
  rankingBreakdown?: PersonalizedBreakdown;
}

function isUserPost(p: Post | UserPost): p is UserPost {
  return p.type === "user";
}

export function PostCard({
  post,
  isNew = false,
  defaultThreadOpen = false,
  rankingBreakdown,
}: PostCardProps) {
  const isMineFlag = isUserPost(post);
  const { viewer } = useViewer();
  // Polish 6 — gate the viewer override on a post-mount flag so SSR
  // (which has no viewer) and the FIRST client render both pick the
  // fixture `currentUser` (= "You"). Without this React threw
  // "Hydration failed because the server rendered HTML didn't match
  // the client" on `/profile/[username]` — SSR rendered the initials
  // span while the first client render rendered the live avatar
  // `<img>`. Now they match; the override kicks in on the second
  // render, which is the normal "after mount" pass that hydration
  // tolerates.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const fixtureUser = isMineFlag ? currentUser : getUser(post.userId);
  // For Supabase posts whose author isn't in the fixture list, synthesize
  // a minimal User shape from the embedded author metadata.
  let user = fixtureUser ?? (() => {
    if (!isUserPost(post)) return null;
    const up = post as UserPost;
    if (!up.authorName) return null;
    return {
      id: up.userId,
      name: up.authorName,
      username: up.authorUsername ?? up.userId,
      avatarUrl: up.authorAvatar ?? null,
      primaryCategory: "tech" as const,
      expertScores: { tech: 50 },
      verified: false,
      bio: "",
      followers: 0,
      following: 0,
      totalPredictions: 0,
      pointsWon: 0,
      joined: new Date().toISOString(),
    } as any;
  })();
  // When this is the viewer's own post, prefer the live profile from
  // Supabase (real name, username, avatar) over the "You" placeholder
  // baked into fixtures.currentUser. Falls back to the embedded
  // authorName/authorAvatar (set at post-create time) so old posts still
  // show the right identity even before useViewer resolves.
  // IMPORTANT: only apply after mount — see the hydration-mismatch note
  // on `mounted` above.
  if (isMineFlag && user && mounted) {
    const up = post as UserPost;
    user = {
      ...user,
      name: viewer?.name || up.authorName || user.name,
      username: viewer?.username || up.authorUsername || user.username,
      avatarUrl: viewer?.avatar_url || up.authorAvatar || user.avatarUrl,
    };
  }
  const liked = useZapStore((s) => s.likedPostIds.includes(post.id));
  const bookmarked = useZapStore((s) => s.bookmarkedPostIds.includes(post.id));
  const toggleLike = useZapStore((s) => s.toggleLike);
  const toggleBookmark = useZapStore((s) => s.toggleBookmarkPost);
  const userComments = useZapStore((s) => s.commentsByPostId[post.id]);
  const recordImpression = useZapStore((s) => s.recordImpression);
  const recordClick = useZapStore((s) => s.recordClick);
  const bumpAffinity = useZapStore((s) => s.bumpAffinity);
  const applyThrottleCheck = useZapStore((s) => s.applyThrottleCheck);
  const toggleBlockAuthor = useZapStore((s) => s.toggleBlockAuthor);
  const blocked = useZapStore((s) =>
    s.blockedAuthorIds.includes((post as any).userId ?? ""),
  );

  const [threadOpen, setThreadOpen] = useState(defaultThreadOpen);
  const [floatHeart, setFloatHeart] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  // Round-3 Item #5 — refuse to route to /profile/undefined when the
  // author username is missing/empty. Falls back to a "not initialized"
  // toast and a non-interactive avatar/name pair so the card stays
  // usable but doesn't crash the router.
  // NOTE: `user` is resolved below; this helper is defined after.

  // Anonymous users see the buttons but ANY click bounces them to
  // sign-in. Keeps the UI feeling real and complete.
  const gate = useRequireSignIn();

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

  // Round-3 Item #5 — only render a real <Link> when we can build a
  // valid /profile/<username>. Empty / undefined / literal "undefined"
  // resolves the click to a friendly toast instead of routing into
  // /profile/undefined and triggering the global not-found.
  const profileHref: string | null = (() => {
    if (isMineFlag) return "/profile/you";
    const u = (user.username ?? "").toString().trim();
    if (!u || u === "undefined" || u === "null") return null;
    return `/profile/${encodeURIComponent(u)}`;
  })();
  const guardProfileClick = (e: React.MouseEvent) => {
    if (profileHref) return;
    e.preventDefault();
    toast.info("User profile not initialized yet", {
      description: "This author hasn't finished setting up their profile.",
    });
  };

  const market = "marketId" in post && post.marketId ? getMarket(post.marketId) : null;
  const category = "category" in post ? post.category : undefined;
  const isLaunch = post.type === "launch";
  const isPrediction = post.type === "prediction";
  const explainCategory =
    (category as string | undefined) ?? market?.category ?? user.primaryCategory;
  const userPost = isMineFlag ? (post as UserPost) : null;
  const boostActive =
    !!userPost?.boostUntil && new Date(userPost.boostUntil).getTime() > Date.now();
  // Drives the multi-layered affinity ring + halo around the avatar.
  // Falls back to the neutral grey from `categoryColor()` for users
  // whose primary category isn't in the curated palette.
  const primaryColor = categoryColor(user.primaryCategory);
  const expertScore = user.expertScores[user.primaryCategory] ?? 50;

  const handleLike = gate(() => {
    if (!liked) {
      setFloatHeart(true);
      setTimeout(() => setFloatHeart(false), 700);
      if (explainCategory) bumpAffinity(explainCategory, "like");
      // Persist quest progress so "like 5 posts" survives reloads.
      fireBumpQuest("like_5");
    }
    // Optimistic local update
    toggleLike(post.id);
    // Persist to Supabase. We never throw — server is the source of
    // truth, but a network blip shouldn't roll back the optimistic UI.
    if (looksLikeServerPostId(post.id)) {
      void toggleLikeAction(post.id).then((result) => {
        if (!result.ok) {
          // Roll back optimistic state on hard failure.
          toggleLike(post.id);
        }
      });
    }
  });
  const handleBookmark = gate(() => {
    const wasBookmarked = bookmarked;
    toggleBookmark(post.id);
    if (!wasBookmarked) fireBumpQuest("save_3");
    if (looksLikeServerPostId(post.id)) {
      void toggleBookmarkAction(post.id).then((result) => {
        if (!result.ok) toggleBookmark(post.id); // roll back
      });
    }
  });
  const handleCommentToggle = gate(() => setThreadOpen((v) => !v));

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
              Just launched · <TimeAgo iso={post.createdAt} /> ago
            </span>
            {market && (
              <span className="ml-auto">
                <CategoryTag category={market.category} />
              </span>
            )}
          </div>
        </>
      )}

      {/* Author row — avatar-dominant with a multi-layered cyber-neon
          affinity ring (Option A). The score chip riding the avatar's
          bottom-right (rendered inside UserAvatar via `showScore`)
          replaces the standalone <ExpertBadge> pill the row used to
          carry, so the rank/specialty signal is now inseparable from
          the face. */}
      <div className="flex items-start gap-3.5 relative">
        <Link
          href={profileHref ?? "#"}
          onClick={guardProfileClick}
          aria-label={
            profileHref
              ? `Open ${user.name}'s profile`
              : "User profile not initialized"
          }
          aria-disabled={!profileHref}
          tabIndex={profileHref ? 0 : -1}
          className={cn(
            "relative inline-block flex-shrink-0 group/avatar",
            !profileHref && "pointer-events-auto cursor-not-allowed opacity-90",
          )}
        >
          {/* Outer halo — soft bloom in the user's primary-category
              hue. Intensifies on hover. Sits OUTSIDE the avatar so
              UserAvatar's own border + floating score chip render
              cleanly on top. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 rounded-full opacity-60 blur-md transition-opacity duration-200 group-hover/avatar:opacity-90"
            style={{
              background: `radial-gradient(closest-side, ${primaryColor}66, transparent 75%)`,
            }}
          />
          {/* Inner crisp rim — the affinity ring proper. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-[3px] rounded-full"
            style={{
              boxShadow: `0 0 0 1px ${primaryColor}aa, 0 0 14px ${primaryColor}55`,
            }}
          />
          {/* The avatar itself — promoted to `lg` so it anchors the
              card visually. UserAvatar already falls back to stylised
              initials over a category-tinted gradient when `src` is
              null/empty, so real photos and fallbacks both look
              first-class. */}
          <UserAvatar
            src={user.avatarUrl}
            name={user.name}
            category={user.primaryCategory}
            score={expertScore}
            size="lg"
            showScore
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={profileHref ?? "#"}
              onClick={guardProfileClick}
              aria-disabled={!profileHref}
              tabIndex={profileHref ? 0 : -1}
              className={cn(
                "font-semibold text-[15px] transition-colors",
                profileHref
                  ? "hover:text-[#FFE600]"
                  : "cursor-not-allowed text-white/90",
              )}
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
            {/* Polish 5 — timestamp doubles as the "open full thread"
                link so search results / mentions / shared URLs can land
                on /post/[id] with full body + comments. Only UUID-shaped
                ids (real Supabase rows) get the link treatment. */}
            {looksLikeServerPostId(post.id) ? (
              <Link
                href={`/post/${post.id}`}
                className="hover:text-[#FFE600] hover:underline underline-offset-2"
              >
                <TimeAgo iso={post.createdAt} />
              </Link>
            ) : (
              <TimeAgo iso={post.createdAt} />
            )}
            {isPrediction
              ? ` · staked ${(post as any).staked}⚡`
              : post.views > 0
                ? ` · ${formatLargeNumber(post.views)} views`
                : ""}
          </div>
        </div>
        {/* Item #4 — the standalone "Why am I seeing this?" Info icon
            was relocated into this 3-dots menu. The dialog version of
            ExposureExplain is rendered below, controlled by
            `explainOpen`. The menu also exposes Block-user, which
            mutes the author in the local feed snapshot. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-[#5A6175] hover:text-white p-1.5"
              aria-label="More post actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setExplainOpen(true);
              }}
              className="cursor-pointer"
            >
              <Info className="h-4 w-4 mr-2 text-[#8B92A8]" />
              Why am I seeing this?
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                toggleBlockAuthor(user.id);
                toast.success(
                  blocked
                    ? `Unblocked @${user.username}`
                    : `Blocked @${user.username}. Future posts hidden.`,
                );
              }}
              className="cursor-pointer text-[#FF4757] focus:text-[#FF4757]"
            >
              <Ban className="h-4 w-4 mr-2" />
              {blocked
                ? "Unblock posts from this user"
                : "Block posts from this user"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ExposureExplain
        post={post}
        author={user}
        category={explainCategory}
        rankingBreakdown={rankingBreakdown}
        controlledOpen={explainOpen}
        onOpenChange={setExplainOpen}
      />

      {/* Body */}
      {post.body && (
        isUserPost(post) && /<[a-z][\s\S]*>/i.test(post.body) ? (
          <div
            className="rich-body text-[15px] leading-[1.55] mt-3.5 mb-2.5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[#FFE600] [&_blockquote]:pl-3 [&_blockquote]:text-[#8B92A8] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#FFE600] [&_a]:underline [&_pre]:font-mono [&_pre]:bg-[#0E1016] [&_pre]:px-2 [&_pre]:py-1 [&_pre]:rounded [&_img]:max-h-[300px] [&_img]:rounded [&_img]:my-1"
            dangerouslySetInnerHTML={{
              __html: linkifyMentions(linkifyHashtags(sanitizeHtml(post.body))),
            }}
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
          onClick={handleCommentToggle}
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
            const next = handleBookmark();
            if (next === undefined && !bookmarked) return; // gated away
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
