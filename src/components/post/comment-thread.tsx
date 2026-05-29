"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Send,
  Reply as ReplyIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { UserAvatar } from "../user-avatar";
import { ExpertBadge } from "../expert-badge";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useZapStore, type UserComment } from "@/lib/store";
import { getUser, seededComments, type SeededComment } from "@/lib/fixtures";
import { cn } from "@/lib/utils";
import { TimeAgo } from "../ui/time-ago";
import { createCommentAction } from "@/app/actions/social";
import { fireBumpQuest } from "@/lib/quest-bump";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_VISIBLE_DEPTH = 4;
const MAX_LEN = 500;
const CURRENT_USER_ID = "u-current";

interface CommentThreadProps {
  postId: string;
  /** Post author id — used to flag OP comments. */
  postAuthorId: string;
  /** Auto-focus the top-level composer when opened */
  autoFocus?: boolean;
  /** Called when the thread should be closed (Esc) */
  onClose?: () => void;
}

type CommentNode = (SeededComment | UserComment) & {
  children: CommentNode[];
};

export function CommentThread({
  postId,
  postAuthorId,
  autoFocus,
  onClose,
}: CommentThreadProps) {
  const userComments = useZapStore(
    useShallow((s) => s.commentsByPostId[postId] ?? [])
  );
  const likedCommentIds = useZapStore((s) => s.likedCommentIds);
  const addComment = useZapStore((s) => s.addComment);
  const toggleCommentLike = useZapStore((s) => s.toggleCommentLike);

  // Build the comment tree from seeded + user comments
  const tree = useMemo<CommentNode[]>(() => {
    const seeded = seededComments[postId] ?? [];
    const all: (SeededComment | UserComment)[] = [...seeded, ...userComments];
    const byId = new Map<string, CommentNode>();
    for (const c of all) byId.set(c.id, { ...c, children: [] });
    const roots: CommentNode[] = [];
    for (const c of all) {
      const node = byId.get(c.id)!;
      const parentId = (c as { parentId?: string | null }).parentId;
      if (parentId && byId.has(parentId)) {
        byId.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // Sort siblings oldest → newest
    const sortRec = (nodes: CommentNode[]) => {
      nodes.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [postId, userComments]);

  // Top-level composer state
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track which comments have an open reply form and which subtrees are collapsed
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Optimistic Zustand update for the local thread renderer; if the
  // post id is a real Supabase UUID, the comment is also persisted via
  // the server action (with Zod + notification fanout). Falls back to
  // local-only for fixture posts so the prototype keeps working.
  const persistComment = (text: string, parentId: string | null) => {
    addComment(postId, text, parentId);
    if (UUID_RE.test(postId)) {
      void createCommentAction({
        postId,
        body: text,
        parentId: parentId ?? undefined,
      }).then((r) => {
        if (!r.ok) toast.error(r.error || "Comment failed to save");
      });
    }
    // Polish 6 — persist quest progress so "comment 2x" and "reply
    // to a comment" survive reloads. Zustand's `addComment` already
    // bumped the local counter; this writes through to profiles.
    fireBumpQuest("comment_twice");
    if (parentId) fireBumpQuest("reply_comment");
  };

  const submitTop = () => {
    const text = body.trim();
    if (!text) return;
    persistComment(text, null);
    toast.success("Reply posted");
    setBody("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitTop();
    }
  };

  const handleSubmitReply = (parentId: string, value: string) => {
    const text = value.trim();
    if (!text) return;
    persistComment(text, parentId);
    toast.success("Reply posted");
    setReplyOpenFor(null);
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = useMemo(() => {
    let n = 0;
    const walk = (nodes: CommentNode[]) => {
      for (const c of nodes) {
        n += 1;
        walk(c.children);
      }
    };
    walk(tree);
    return n;
  }, [tree]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-3 border-t border-[#2A2F3D] pt-3 overflow-hidden"
    >
      {/* Top composer */}
      <div className="flex gap-2.5 items-start mb-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] font-bold text-xs flex-shrink-0">
          Y
        </div>
        <div className="flex-1 min-w-0">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={onKeyDown}
            placeholder="Add a reply… (⌘+Enter to send)"
            rows={2}
            className="min-h-[60px] text-sm"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono text-[#5A6175] tabular-nums">
              {body.length}/{MAX_LEN}
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={submitTop}
              disabled={!body.trim()}
              className="h-7"
            >
              <Send className="h-3 w-3" />
              Reply
            </Button>
          </div>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="text-[12px] font-mono text-[#5A6175] text-center py-3">
          Be the first to reply.
        </div>
      ) : (
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] mb-1">
          {total} {total === 1 ? "reply" : "replies"}
        </div>
      )}

      <AnimatePresence initial={false}>
        {tree.map((node) => (
          <CommentBranch
            key={node.id}
            node={node}
            depth={0}
            postAuthorId={postAuthorId}
            likedCommentIds={likedCommentIds}
            toggleCommentLike={toggleCommentLike}
            replyOpenFor={replyOpenFor}
            setReplyOpenFor={setReplyOpenFor}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            onSubmitReply={handleSubmitReply}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

interface BranchProps {
  node: CommentNode;
  depth: number;
  postAuthorId: string;
  likedCommentIds: string[];
  toggleCommentLike: (id: string) => void;
  replyOpenFor: string | null;
  setReplyOpenFor: (id: string | null) => void;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  onSubmitReply: (parentId: string, body: string) => void;
}

function CommentBranch({
  node,
  depth,
  postAuthorId,
  likedCommentIds,
  toggleCommentLike,
  replyOpenFor,
  setReplyOpenFor,
  collapsed,
  toggleCollapse,
  onSubmitReply,
}: BranchProps) {
  const author = getUser(node.authorId);
  if (!author) return null;
  const isMine = node.authorId === CURRENT_USER_ID;
  const isOP = node.authorId === postAuthorId;
  const liked = likedCommentIds.includes(node.id);
  const replyOpen = replyOpenFor === node.id;
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  // After 4 levels of indent, stop indenting and show a "Continue thread" link instead
  const maxedOut = depth >= MAX_VISIBLE_DEPTH;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "relative",
        depth > 0 &&
          "before:absolute before:left-[15px] before:top-0 before:bottom-0 before:w-px before:bg-[#2A2F3D]"
      )}
      style={depth > 0 ? { paddingLeft: 28 } : undefined}
    >
      <div className="flex gap-2.5 items-start py-2.5">
        {/* Collapse toggle (replaces avatar pad slot when has children) */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={isCollapsed ? "Expand replies" : "Collapse replies"}
            aria-expanded={!isCollapsed}
            onClick={() => toggleCollapse(node.id)}
            className="mt-0.5 h-6 w-6 -ml-1 inline-flex items-center justify-center rounded text-[#5A6175] hover:text-white hover:bg-[#20232E]/60 transition-colors shrink-0"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}

        <Link
          href={isMine ? "/profile/you" : `/profile/${author.username}`}
          className="shrink-0"
        >
          <UserAvatar
            src={author.avatarUrl}
            name={author.name}
            size="xs"
            category={author.primaryCategory}
            showScore={false}
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={isMine ? "/profile/you" : `/profile/${author.username}`}
              className="text-xs font-semibold hover:text-[#FFE600]"
            >
              {author.name}
            </Link>
            <ExpertBadge
              category={author.primaryCategory}
              score={author.expertScores[author.primaryCategory] ?? 50}
            />
            {isOP && (
              <span
                title="Original poster"
                className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#4DA3FF]/15 text-[#4DA3FF] border border-[#4DA3FF]/40 px-1.5 py-0.5 rounded"
              >
                OP
              </span>
            )}
            {isMine && !isOP && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 px-1.5 py-0.5 rounded">
                You
              </span>
            )}
            <span
              suppressHydrationWarning
              className="text-[10px] font-mono text-[#5A6175]"
            >
              <TimeAgo iso={node.createdAt} />
            </span>
          </div>
          <p className="text-sm leading-relaxed mt-0.5 text-[#E5E5E5] whitespace-pre-wrap">
            {node.body}
          </p>

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleCommentLike(node.id)}
              aria-pressed={liked}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-mono transition-colors",
                liked ? "text-[#FF4757]" : "text-[#5A6175] hover:text-white"
              )}
            >
              <Heart className={cn("h-3 w-3", liked && "fill-[#FF4757]")} />
              {node.likes + (liked ? 1 : 0)}
            </button>
            <button
              type="button"
              onClick={() =>
                setReplyOpenFor(replyOpen ? null : node.id)
              }
              aria-expanded={replyOpen}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-mono transition-colors",
                replyOpen
                  ? "text-[#FFE600]"
                  : "text-[#5A6175] hover:text-white"
              )}
            >
              <ReplyIcon className="h-3 w-3" />
              Reply
            </button>
            {isCollapsed && hasChildren && (
              <span className="text-[10px] font-mono text-[#5A6175]">
                {countDescendants(node)} hidden
              </span>
            )}
          </div>

          {/* Inline reply mini-composer */}
          <AnimatePresence initial={false}>
            {replyOpen && (
              <ReplyComposer
                onCancel={() => setReplyOpenFor(null)}
                onSubmit={(value) => onSubmitReply(node.id, value)}
                replyingTo={author.name}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {hasChildren && !isCollapsed && (
          <motion.div
            key={`children-${node.id}`}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {maxedOut ? (
              <ContinueThreadLink count={countDescendants(node)} />
            ) : (
              node.children.map((child) => (
                <CommentBranch
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  postAuthorId={postAuthorId}
                  likedCommentIds={likedCommentIds}
                  toggleCommentLike={toggleCommentLike}
                  replyOpenFor={replyOpenFor}
                  setReplyOpenFor={setReplyOpenFor}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  onSubmitReply={onSubmitReply}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReplyComposer({
  onCancel,
  onSubmit,
  replyingTo,
}: {
  onCancel: () => void;
  onSubmit: (value: string) => void;
  replyingTo: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -4 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="mt-2 overflow-hidden"
    >
      <div className="rounded-md border border-[#2A2F3D] bg-[#14161D] p-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175] mb-1.5">
          Replying to <span className="text-white">{replyingTo}</span>
        </div>
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Write a reply…"
          rows={2}
          className="min-h-[52px] text-sm bg-[#0E1016]"
        />
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono text-[#5A6175] tabular-nums">
            {value.length}/{MAX_LEN}
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 text-[#8B92A8]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!value.trim()}
            className="h-7"
          >
            <Send className="h-3 w-3" /> Reply
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ContinueThreadLink({ count }: { count: number }) {
  return (
    <div className="pl-7 py-2">
      <button
        type="button"
        onClick={() => {
          // No deep-thread page yet — Phase 9 graceful no-op.
          // The button is kept so users see the affordance.
        }}
        className="text-[11px] font-mono text-[#4DA3FF] hover:underline"
      >
        Continue thread → ({count} more)
      </button>
    </div>
  );
}

function countDescendants(node: CommentNode): number {
  let n = 0;
  const walk = (nodes: CommentNode[]) => {
    for (const c of nodes) {
      n += 1;
      walk(c.children);
    }
  };
  walk(node.children);
  return n;
}
