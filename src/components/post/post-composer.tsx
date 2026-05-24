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
import { useZapStore } from "@/lib/store";
import { sanitizeHtml } from "@/lib/sanitize";
import { CATEGORIES, markets, type Category } from "@/lib/mock-data";
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
  const balance = useZapStore((s) => s.points);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const reset = () => {
    editorRef.current?.clear();
    setBodyHtml("");
    setBodyText("");
    setCategory("");
    setMarketId("");
    setImages([]);
    setBoostEnabled(false);
  };

  const handlePublish = useCallback(() => {
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
    const cleanHtml = sanitizeHtml(bodyHtml);
    const willBoost = boostEnabled && boostAmount <= balance;
    addPost({
      body: cleanHtml,
      category: category as Category,
      marketId: marketId || undefined,
      images: images.length > 0 ? images : undefined,
      boostZaps: willBoost ? boostAmount : undefined,
      boostDurationH: willBoost ? boostDurationH : undefined,
    });
    toast.success(willBoost ? "Posted & boosted 🚀" : "Posted ⚡", {
      description: willBoost
        ? `${boostAmount}⚡ boost for ${boostDurationH}h.`
        : "Your take is live on the feed.",
    });
    reset();
    onPublish?.();
    if (variant === "feed") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/feed");
    }
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
  ]);

  // Image upload helpers
  const ingestFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    arr.slice(0, remaining).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setImages((prev) =>
            prev.length < MAX_IMAGES ? [...prev, dataUrl] : prev
          );
        }
      };
      reader.readAsDataURL(file);
    });
    if (arr.length > remaining) {
      toast.warning(`Max ${MAX_IMAGES} images`, {
        description: `Only the first ${remaining} were added.`,
      });
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
        <motion.div
          role="radiogroup"
          aria-label="Post category"
          aria-required="true"
          className={cn(
            "flex flex-wrap gap-1.5 p-2 rounded-md border transition-colors",
            category
              ? "border-transparent"
              : pulseCategory
              ? "border-[#FFE600] bg-[#FFE600]/8 shadow-[0_0_0_4px_rgba(255,230,0,0.12)]"
              : "border-dashed border-[#2A2F3D] hover:border-[#353B4D]"
          )}
          animate={
            pulseCategory
              ? { scale: [1, 1.01, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.5, repeat: pulseCategory ? 2 : 0 }}
        >
          {CATEGORIES.map((c) => {
            const active = category === c;
            const color = categoryColor(c);
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(c)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-semibold capitalize transition-all",
                  active ? "scale-[1.03]" : "hover:scale-[1.02]"
                )}
                style={{
                  borderColor: active ? color : "#2A2F3D",
                  color: active ? color : "#8B92A8",
                  background: active ? `${color}14` : "transparent",
                  boxShadow: active ? `0 0 0 2px ${color}33` : undefined,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
                {c}
              </button>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-4 flex gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] font-bold flex-shrink-0">
          Y
        </div>

        <div className="flex-1 min-w-0">
          <RichEditor
            ref={editorRef}
            placeholder="What's your call?"
            onChange={(html, text) => {
              setBodyHtml(html);
              setBodyText(text);
            }}
            onKeyDownPublish={handlePublish}
            maxLen={MAX_LEN}
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

            <div className="flex-1" />

            <span className="text-[10px] font-mono text-[#5A6175] tabular-nums">
              {bodyText.length}/{MAX_LEN}
            </span>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={!canPublish}
              className="h-7"
              title={!canPublish ? publishLabel : "Cmd/Ctrl+Enter"}
            >
              <Send className="h-3 w-3" />
              {!hasBody
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
