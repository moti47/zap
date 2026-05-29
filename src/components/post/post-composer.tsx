"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  BarChart3,
  X,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { MarketCardCompact } from "../market/market-card-compact";
import { AttachMarketDialog } from "../market/attach-market-dialog";
import { RichEditor, type RichEditorHandle } from "./rich-editor";
import { BoostControl } from "./boost-control";
import { DraftsMenu } from "./drafts-menu";
import { MentionPopover } from "./mention-popover";
import { CategoryPicker } from "./category-picker";
import { ChevronRight } from "lucide-react";
import { useZapStore } from "@/lib/store";
import { useViewer } from "@/lib/use-viewer";
import { sanitizeHtml, htmlToPlainText } from "@/lib/sanitize";
import { extractMentions } from "@/lib/mentions";
import { notifyMentionsAction } from "@/app/feed/actions";
import { createPostAction } from "@/app/actions/social";
import { CATEGORIES, markets, type Category } from "@/lib/fixtures";
import { cn, categoryColor } from "@/lib/utils";
import {
  BOOST_AMOUNTS,
  type BoostAmount,
  type BoostDurationH,
} from "@/lib/exposure";

const MAX_LEN = 5000;
const MAX_IMAGES = 4;

interface PostComposerProps {
  onPublish?: () => void;
  autoFocus?: boolean;
  variant?: "feed" | "modal";
}

export function PostComposer({
  onPublish,
  autoFocus,
  variant = "feed",
}: PostComposerProps) {
  const router = useRouter();
  const addPost = useZapStore((s) => s.addPost);
  const replaceLocalPostId = useZapStore((s) => s.replaceLocalPostId);
  // Round-2 — boost-cost gating must use the real DB balance, not the
  // Zustand 50-Zap default. Otherwise signed-in users with a real
  // balance get "Not enough Zaps to boost" toasts wrongly.
  const storeBalance = useZapStore((s) => s.points);
  const { viewer: composerViewer } = useViewer();
  const balance = composerViewer ? composerViewer.zaps : storeBalance;
  const upsertDraft = useZapStore((s) => s.upsertDraft);
  const deleteDraft = useZapStore((s) => s.deleteDraft);

  const editorRef = useRef<RichEditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);

  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [marketId, setMarketId] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pulseCategory, setPulseCategory] = useState(false);
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [boostAmount, setBoostAmount] = useState<BoostAmount>(BOOST_AMOUNTS[1]);
  const [boostDurationH, setBoostDurationH] = useState<BoostDurationH>(4);
  const [editorInitialHtml, setEditorInitialHtml] = useState<string | undefined>(
    undefined,
  );
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const draftSaveTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const publishLockRef = useRef(false);

  // Legacy support: pick up market attached via the old catalog-redirect flow
  // (?attachMarket=…) so deep links don't break.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const attach = params.get("attachMarket");
    if (attach && markets.find((m) => m.id === attach)) {
      setMarketId(attach);
      const url = new URL(window.location.href);
      url.searchParams.delete("attachMarket");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const hasBody = bodyText.trim().length > 0;
  const canPublish = hasBody && category !== "" && bodyText.length <= MAX_LEN;
  const attachedMarket = marketId
    ? markets.find((m) => m.id === marketId)
    : null;

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus();
  }, [autoFocus]);

  // Item #3 — Topbar "+ Compose" dispatches `zap:focus-composer` after
  // a smooth-scroll to top. Only the in-feed variant should react; the
  // modal variant must not steal focus when an unrelated event fires.
  useEffect(() => {
    if (variant !== "feed") return;
    const onFocusComposer = () => {
      requestAnimationFrame(() => editorRef.current?.focus());
    };
    window.addEventListener("zap:focus-composer", onFocusComposer);
    return () =>
      window.removeEventListener("zap:focus-composer", onFocusComposer);
  }, [variant]);

  const reset = () => {
    editorRef.current?.clear();
    setEditorInitialHtml(undefined);
    setBodyHtml("");
    setBodyText("");
    setCategory("");
    setMarketId("");
    setImages([]);
    setBoostEnabled(false);
    setDraftId(undefined);
    setDraftStatus("idle");
  };

  // Auto-save draft (debounced) whenever the composer has any content.
  useEffect(() => {
    const isEmpty = !bodyText.trim() && images.length === 0 && !marketId && !category;
    if (isEmpty) return;
    if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    setDraftStatus("saving");
    draftSaveTimerRef.current = window.setTimeout(() => {
      const saved = upsertDraft({
        id: draftId,
        bodyHtml,
        category,
        marketId: marketId || undefined,
        images: images.length > 0 ? images : undefined,
      });
      if (!draftId) setDraftId(saved.id);
      setDraftStatus("saved");
    }, 800);
    return () => {
      if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml, category, marketId, images]);

  const loadDraft = (id: string) => {
    const { drafts } = useZapStore.getState();
    const d = drafts.find((x) => x.id === id);
    if (!d) return;
    setDraftId(d.id);
    setEditorInitialHtml(d.bodyHtml);
    setBodyHtml(d.bodyHtml);
    setBodyText(htmlToPlainText(d.bodyHtml));
    setCategory(d.category ?? "");
    setMarketId(d.marketId ?? "");
    setImages(d.images ?? []);
    setDraftStatus("saved");
    toast.success("Draft restored");
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const handlePublish = useCallback(() => {
    // Duplicate-submit guard. The ref handles the synchronous case
    // (rapid Cmd+Enter spam); the state drives the button UI.
    if (publishLockRef.current || isPublishing) return;
    if (!hasBody) {
      toast.error("Write something first");
      return;
    }
    if (!category) {
      setPulseCategory(true);
      categoryRowRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      window.setTimeout(() => setPulseCategory(false), 1400);
      toast.error("Pick a category", {
        description: "Every post needs a category before it goes live.",
      });
      return;
    }
    if (bodyText.length > MAX_LEN) return;
    if (boostEnabled && boostAmount > balance) {
      toast.error("Not enough Zaps to boost", {
        description: `Balance ${balance}⚡ — boost costs ${boostAmount}⚡.`,
      });
      return;
    }
    publishLockRef.current = true;
    setIsPublishing(true);
    const cleanHtml = sanitizeHtml(bodyHtml);
    const willBoost = boostEnabled && boostAmount <= balance;
    let newPost;
    try {
      newPost = addPost({
        body: cleanHtml,
        category: category as Category,
        marketId: marketId || undefined,
        images: images.length > 0 ? images : undefined,
        boostZaps: willBoost ? boostAmount : undefined,
        boostDurationH: willBoost ? boostDurationH : undefined,
      });
    } catch (err) {
      publishLockRef.current = false;
      setIsPublishing(false);
      const message = err instanceof Error ? err.message : "Couldn't publish";
      toast.error(message, {
        description: "Your draft is still saved — try again in a moment.",
      });
      return;
    }
    // Persist to Supabase. The optimistic local post (newPost) already
    // shows in the feed. Once the server insert succeeds we:
    //   1. Swap the temp `up-…` id for the real Supabase UUID so the
    //      feed-stream dedupes correctly against `initialServerPosts`
    //      on the next snapshot pass (otherwise the post would render
    //      twice — once from Zustand, once from the server fetch).
    //   2. Call `router.refresh()` so any other surface backed by the
    //      RSC cache (the profile page, /feed) sees the new row
    //      immediately, no manual reload required.
    // If the server save fails we surface a toast and keep the local
    // copy so the user doesn't lose their draft.
    if (category) {
      void createPostAction({
        body_html: cleanHtml,
        category_slug: category,
        market_id: marketId || null,
        images: images.length > 0 ? images : undefined,
        boost_zaps: willBoost ? boostAmount : undefined,
        boost_until: willBoost
          ? new Date(Date.now() + boostDurationH * 3600 * 1000).toISOString()
          : null,
      }).then((result) => {
        if (result.ok && result.id && newPost) {
          replaceLocalPostId(newPost.id, result.id);
          // Re-fetch the server-rendered initialServerPosts so the post
          // also shows up after a hard reload.
          router.refresh();
        } else if (!result.ok) {
          // Only complain if the user is signed in — anonymous users
          // never expect server persistence.
          if (!/sign(ed)? in/i.test(result.error)) {
            toast.error("Couldn't save to server", { description: result.error });
          }
        }
      });
    }
    // Phase 9 — fire @mention notifications (best-effort, fails silently
    // when there's no Supabase backend wired).
    const mentioned = extractMentions(bodyText);
    if (mentioned.length) {
      void notifyMentionsAction({
        usernames: mentioned,
        post_id: newPost.id,
        excerpt: bodyText.slice(0, 140),
      }).catch(() => {});
    }
    toast.success(willBoost ? "Posted & boosted 🚀" : "Posted ⚡", {
      description: willBoost
        ? `${boostAmount}⚡ boost for ${boostDurationH}h.`
        : "Your take is live on the feed.",
    });
    if (draftId) deleteDraft(draftId);
    reset();
    onPublish?.();
    if (variant === "feed") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/feed");
    }
    // Release the publish lock after a short cooldown so accidental
    // double-clicks during the toast animation can't fire a 2nd insert.
    window.setTimeout(() => {
      publishLockRef.current = false;
      setIsPublishing(false);
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasBody,
    bodyHtml,
    bodyText,
    category,
    marketId,
    images,
    boostEnabled,
    boostAmount,
    boostDurationH,
    balance,
    isPublishing,
    replaceLocalPostId,
  ]);

  // Image upload — posts to /api/upload (Supabase Storage when configured,
  // otherwise data-URL fallback so the prototype demo keeps working).
  const ingestFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const toUpload = arr.slice(0, remaining);
    if (arr.length > remaining) {
      toast.warning(`Max ${MAX_IMAGES} images`, {
        description: `Only the first ${remaining} were added.`,
      });
    }
    for (const file of toUpload) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = (await res.json()) as { url?: string; error?: string };
        if (json.url) {
          setImages((prev) =>
            prev.length < MAX_IMAGES ? [...prev, json.url!] : prev,
          );
        } else if (json.error) {
          toast.error("Upload failed", { description: json.error });
        }
      } catch (e) {
        toast.error("Upload failed", {
          description: e instanceof Error ? e.message : "Network error",
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) ingestFiles(e.dataTransfer.files);
  };

  // Cmd/Ctrl+Enter to publish anywhere within the composer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (containerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          handlePublish();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePublish]);

  const publishLabel = !hasBody
    ? "Write something to post"
    : !category
    ? "Select a category to post"
    : `Post to ${category} ⚡`;

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-[14px] border bg-[#1A1D26] p-4 transition-colors",
        dragOver ? "border-[#FFE600]/50 bg-[#FFE600]/5" : "border-[#2A2F3D]"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* CATEGORY ROW — prominent, REQUIRED. */}
      <div ref={categoryRowRef}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#8B92A8] inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#FFE600]" />
            Step 1 · Pick a category
          </div>
          {category && (
            <button
              type="button"
              onClick={() => setCategory("")}
              className="text-[10px] font-mono text-[#5A6175] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
        <motion.button
          type="button"
          aria-label="Pick a category"
          aria-required="true"
          aria-haspopup="dialog"
          onClick={() => setCategoryPickerOpen(true)}
          className={cn(
            "group w-full flex items-center gap-3 p-3 rounded-[12px] border transition-all text-left",
            category
              ? "border-transparent"
              : pulseCategory
              ? "border-[#FFE600] bg-[#FFE600]/8 shadow-[0_0_0_4px_rgba(255,230,0,0.12)]"
              : "border-dashed border-[#2A2F3D] hover:border-[#353B4D]"
          )}
          animate={pulseCategory ? { scale: [1, 1.01, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, repeat: pulseCategory ? 2 : 0 }}
          style={
            category
              ? {
                  borderColor: `${categoryColor(category)}66`,
                  background: `linear-gradient(135deg, ${categoryColor(
                    category,
                  )}10, transparent 60%)`,
                  boxShadow: `0 0 0 2px ${categoryColor(category)}22`,
                }
              : undefined
          }
        >
          {category ? (
            <>
              <div
                className="h-9 w-9 rounded-[10px] grid place-items-center text-base shrink-0"
                style={{
                  background: `${categoryColor(category)}22`,
                  border: `1px solid ${categoryColor(category)}40`,
                }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: categoryColor(category) }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[14px] font-bold capitalize"
                  style={{ color: categoryColor(category) }}
                >
                  {category}
                </div>
                <div className="text-[11px] text-[#8B92A8]">
                  Tap to change category
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-9 w-9 rounded-[10px] grid place-items-center bg-[#FFE600]/10 border border-[#FFE600]/30 shrink-0">
                <Sparkles className="h-4 w-4 text-[#FFE600]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-white">
                  Pick a category
                </div>
                <div className="text-[11px] text-[#8B92A8]">
                  Required — choose where your post lives
                </div>
              </div>
            </>
          )}
          <ChevronRight className="h-4 w-4 text-[#5A6175] group-hover:text-white shrink-0" />
        </motion.button>
      </div>
      <CategoryPicker
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        value={category}
        onChange={(c) => setCategory(c)}
      />

      <div className="mt-4 flex gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] font-bold flex-shrink-0">
          Y
        </div>

        <div className="flex-1 min-w-0">
          <RichEditor
            ref={editorRef}
            placeholder="What's your call? Try @username to mention someone."
            initialHtml={editorInitialHtml}
            onChange={(html, text) => {
              setBodyHtml(html);
              setBodyText(text);
              // Detect open `@xxx` partial token near the end so the
              // popover can show suggestions. We deliberately read from the
              // end of the text only — the editor cursor is almost always
              // there as the user types.
              const tail = text.slice(-32);
              const m = tail.match(/(?:^|[\s>(])@([a-z0-9_]{0,20})$/i);
              setMentionQuery(m ? m[1] : null);
            }}
            onKeyDownPublish={handlePublish}
            maxLen={MAX_LEN}
          />

          <MentionPopover
            query={mentionQuery}
            onPick={(u) => {
              editorRef.current?.replaceMention(u.username);
              setMentionQuery(null);
            }}
            onClose={() => setMentionQuery(null)}
          />

          {/* Image previews */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {images.map((src, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative aspect-video rounded-md overflow-hidden border border-[#2A2F3D]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    aria-label="Remove image"
                    onClick={() =>
                      setImages((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 hover:bg-black flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Attached market — preview card with remove */}
          <AnimatePresence>
            {attachedMarket && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="relative mt-3"
              >
                <div className="absolute -top-2.5 left-3 z-10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-[#FFE600] bg-[#1A1D26] border border-[#FFE600]/40 rounded-full">
                  Attached question
                </div>
                <button
                  aria-label="Remove market"
                  onClick={() => setMarketId("")}
                  className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-[#14161D] border border-[#2A2F3D] hover:border-[#FF4757] flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
                <MarketCardCompact market={attachedMarket} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => setAttachOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors",
                marketId
                  ? "border-[#FFE600]/40 text-[#FFE600] bg-[#FFE600]/8"
                  : "border-[#2A2F3D] text-[#8B92A8] hover:text-white hover:border-[#353B4D]"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {marketId ? "Swap question" : "+ Attach question"}
            </button>

            <button
              type="button"
              aria-label="Upload image"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= MAX_IMAGES}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[#2A2F3D] text-[#8B92A8] hover:text-white text-xs font-medium hover:border-[#353B4D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Image
              {images.length > 0 && (
                <span className="font-mono text-[10px] text-[#FFE600]">
                  {images.length}/{MAX_IMAGES}
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && ingestFiles(e.target.files)}
            />

            <DraftsMenu
              status={draftStatus}
              currentDraftId={draftId}
              onLoad={loadDraft}
            />

            <div className="flex-1" />

            <span className="text-[10px] font-mono text-[#5A6175] tabular-nums">
              {bodyText.length}/{MAX_LEN}
            </span>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={!canPublish || isPublishing}
              className="h-7"
              title={!canPublish ? publishLabel : "Cmd/Ctrl+Enter"}
            >
              <Send className="h-3 w-3" />
              {isPublishing
                ? "Posting…"
                : !hasBody
                ? "Post"
                : !category
                ? "Pick a category"
                : boostEnabled
                ? `Post & boost ${boostAmount}⚡`
                : `Post to ${category}`}
            </Button>
          </div>

          {/* Phase 6 — boost control */}
          <div className="mt-3">
            <BoostControl
              enabled={boostEnabled}
              amount={boostAmount}
              durationH={boostDurationH}
              balance={balance}
              onToggle={setBoostEnabled}
              onAmountChange={setBoostAmount}
              onDurationChange={setBoostDurationH}
            />
          </div>
        </div>
      </div>

      {/* Attach-question modal — only fires onConfirm after explicit click */}
      <AttachMarketDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        onConfirm={(id) => {
          setMarketId(id);
          const m = markets.find((mm) => mm.id === id);
          toast.success("Question attached", {
            description: m ? m.question.slice(0, 80) : undefined,
          });
        }}
      />
    </div>
  );
}
