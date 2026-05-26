"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Clock,
  Loader2,
  ExternalLink,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveProposalAction,
  rejectProposalAction,
} from "@/app/admin/actions";
import { cn } from "@/lib/utils";

interface PendingProposal {
  id: string;
  question: string;
  description: string;
  resolution_date: string;
  resolution_source: string;
  initial_yes_price: number;
  hero_image_url: string | null;
  created_at: string;
  proposer?: {
    id: string;
    username: string;
    name: string;
    avatar_url: string | null;
  } | null;
  category?: {
    id: string;
    slug: string;
    name: string;
    color: string;
  } | null;
}

export function ProposalsQueue({
  initialPending,
}: {
  initialPending: PendingProposal[];
}) {
  const [pending, setPending] = useState<PendingProposal[]>(initialPending);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  const onApprove = (p: PendingProposal) => {
    setPendingActionId(p.id);
    const t = toast.loading(`Approving "${p.question.slice(0, 30)}…"`);
    startTransition(async () => {
      const result = await approveProposalAction(p.id);
      setPendingActionId(null);
      if (!result.ok) {
        toast.error(result.error, { id: t });
        return;
      }
      toast.success("Market live", {
        id: t,
        description: `Approved · /market/${result.marketId}`,
      });
      setPending((prev) => prev.filter((x) => x.id !== p.id));
    });
  };

  const onConfirmReject = (p: PendingProposal) => {
    if (reason.trim().length < 4) {
      toast.error("Give a reason — proposers will see it.");
      return;
    }
    setPendingActionId(p.id);
    const t = toast.loading("Rejecting…");
    const r = reason.trim();
    startTransition(async () => {
      const result = await rejectProposalAction(p.id, r);
      setPendingActionId(null);
      if (!result.ok) {
        toast.error(result.error, { id: t });
        return;
      }
      toast.success("Rejected", { id: t });
      setPending((prev) => prev.filter((x) => x.id !== p.id));
      setRejectingId(null);
      setReason("");
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600] inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          Admin · review queue
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          Proposal queue
        </h1>
        <p className="text-[13px] text-[#8B92A8] mt-1 max-w-[560px]">
          {pending.length === 0
            ? "Inbox zero. New proposals will show up here."
            : `${pending.length} proposal${pending.length === 1 ? "" : "s"} waiting for review.`}
        </p>
      </header>

      {pending.length === 0 ? (
        <section className="rounded-[14px] border border-dashed border-[#2A2F3D] p-10 text-center text-[#8B92A8] text-[13px]">
          No pending proposals.
        </section>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {pending.map((p) => {
              const isRejecting = rejectingId === p.id;
              const isBusy = pendingActionId === p.id;
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden"
                >
                  {p.hero_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.hero_image_url}
                      alt=""
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-white leading-snug">
                          {p.question}
                        </h3>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono text-[#5A6175] flex-wrap">
                          {p.proposer && (
                            <span>
                              @{p.proposer.username}
                            </span>
                          )}
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(p.created_at).toLocaleString()}
                          </span>
                          <span>·</span>
                          <span>opens {p.initial_yes_price}¢ YES</span>
                          <span>·</span>
                          <span>
                            resolves {new Date(p.resolution_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {p.category && (
                        <span
                          className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border shrink-0"
                          style={{
                            color: p.category.color,
                            borderColor: `${p.category.color}55`,
                            background: `${p.category.color}10`,
                          }}
                        >
                          {p.category.slug}
                        </span>
                      )}
                    </div>

                    {p.description && (
                      <p className="text-[13px] text-[#8B92A8] leading-relaxed whitespace-pre-wrap">
                        {p.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11.5px] text-[#8B92A8]">
                      <ExternalLink className="h-3.5 w-3.5 text-[#4DA3FF]" />
                      <span className="font-mono">{p.resolution_source}</span>
                    </div>

                    {!isRejecting && (
                      <div className="pt-3 border-t border-[#2A2F3D] flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setRejectingId(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#FF4757]/30 text-[#FF4757] text-[12px] font-semibold hover:bg-[#FF4757]/10 transition-colors disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onApprove(p)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#36D399] text-[#0A0B0F] text-[12px] font-bold transition-transform",
                            !isBusy && "hover:scale-[1.02] active:scale-95",
                            isBusy && "opacity-60",
                          )}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Approving…
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Approve &amp; create
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {isRejecting && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-md border border-[#FF4757]/30 bg-[#FF4757]/8 p-3 space-y-2"
                      >
                        <div className="text-[11.5px] font-semibold text-[#FF4757] inline-flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Reject reason — visible to the proposer
                        </div>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value.slice(0, 500))}
                          rows={2}
                          placeholder="Ambiguous resolution criteria — please specify the exact data source."
                          className="w-full rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FF4757] outline-none p-2.5 text-[13px] text-white placeholder:text-[#5A6175]"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setReason("");
                            }}
                            className="text-[11px] text-[#8B92A8] hover:text-white px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onConfirmReject(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FF4757] text-white text-[12px] font-bold hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Rejecting…
                              </>
                            ) : (
                              <>
                                <X className="h-3.5 w-3.5" />
                                Confirm reject
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
