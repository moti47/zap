"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useZapStore } from "@/lib/store";
import { htmlToPlainText } from "@/lib/sanitize";
import { cn, categoryColor } from "@/lib/utils";
import { TimeAgo } from "../ui/time-ago";

interface DraftsMenuProps {
  status: "idle" | "saving" | "saved";
  currentDraftId?: string;
  onLoad: (id: string) => void;
}

export function DraftsMenu({ status, currentDraftId, onLoad }: DraftsMenuProps) {
  const drafts = useZapStore(useShallow((s) => s.drafts));
  const deleteDraft = useZapStore((s) => s.deleteDraft);

  const sorted = useMemo(
    () =>
      [...drafts].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [drafts],
  );

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
      ? "Saved"
      : drafts.length > 0
      ? `Drafts · ${drafts.length}`
      : "Drafts";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Drafts"
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors",
            status === "saved" || status === "saving"
              ? "border-[#FFE600]/30 text-[#FFE600] bg-[#FFE600]/5"
              : "border-[#2A2F3D] text-[#8B92A8] hover:text-white hover:border-[#353B4D]",
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          {label}
          {status === "saving" && (
            <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#FFE600] animate-pulse" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[#2A2F3D] flex items-center">
          <div className="font-semibold text-white text-[13px]">Drafts</div>
          <span className="flex-1" />
          <span className="text-[10px] font-mono text-[#5A6175]">
            {drafts.length}/20
          </span>
        </div>
        {sorted.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px] text-[#5A6175]">
            No drafts yet — start typing and we'll save automatically.
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {sorted.map((d) => {
                const preview =
                  htmlToPlainText(d.bodyHtml).slice(0, 90) || "(empty body)";
                const isCurrent = d.id === currentDraftId;
                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "group flex items-start gap-2 px-3 py-2 border-b border-[#2A2F3D] last:border-b-0 hover:bg-[#20232E] cursor-pointer transition-colors",
                      isCurrent && "bg-[#FFE600]/5",
                    )}
                    onClick={() => onLoad(d.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {d.category && (
                          <span
                            className="text-[9.5px] font-mono uppercase tracking-widest"
                            style={{ color: categoryColor(d.category) }}
                          >
                            {d.category}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-[#5A6175]">
                          <TimeAgo iso={d.updatedAt} /> ago
                        </span>
                        {d.images && d.images.length > 0 && (
                          <span className="text-[10px] font-mono text-[#5A6175]">
                            · 🖼️ {d.images.length}
                          </span>
                        )}
                        {d.marketId && (
                          <span className="text-[10px] font-mono text-[#FFE600]">
                            · ⚡
                          </span>
                        )}
                      </div>
                      <div className="text-[12.5px] text-white leading-snug line-clamp-2">
                        {preview}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete draft"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDraft(d.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5A6175] hover:text-[#FF4757] p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
