"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resolveMarketAction } from "@/app/market/[id]/actions";
import { cn } from "@/lib/utils";

interface Props {
  marketId: string;
  marketQuestion: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ResolveMarketDialog({
  marketId,
  marketQuestion,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"yes" | "no" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setOutcome(null);
    setConfirming(false);
  };

  const submit = () => {
    if (!outcome) return;
    const tId = toast.loading("Resolving market…");
    startTransition(async () => {
      const res = await resolveMarketAction({ marketId, outcome });
      if (!res.ok) {
        toast.error(res.error || "Resolution failed", { id: tId });
        return;
      }
      toast.success(
        `Market resolved ${outcome.toUpperCase()} · ${res.settledPositions} position${
          res.settledPositions === 1 ? "" : "s"
        } settled · ${res.totalPayout}⚡ paid out`,
        { id: tId },
      );
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-[#2A2F3D]">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#FFB800]" />
            Resolve market
          </DialogTitle>
          <DialogDescription className="text-[#8B92A8]">
            Pick the outcome. Winning shares are paid 100⚡ each. This is
            final — markets can't be re-resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div className="text-sm font-medium leading-snug">
            {marketQuestion}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <OutcomeButton
              label="YES"
              color="#00D982"
              selected={outcome === "yes"}
              onClick={() => setOutcome("yes")}
            />
            <OutcomeButton
              label="NO"
              color="#FF4757"
              selected={outcome === "no"}
              onClick={() => setOutcome("no")}
            />
          </div>

          {outcome && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md py-3 font-semibold text-sm bg-[#FFE600] text-[#0A0B0F] hover:bg-[#FFC700] transition-colors"
            >
              Continue to confirm
            </button>
          )}

          {confirming && (
            <div className="rounded-md border border-[#FF4757]/30 bg-[#FF4757]/8 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-[#FF4757] mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold">This cannot be undone.</div>
                  <div className="text-[#8B92A8] text-xs mt-0.5">
                    Settling{" "}
                    <span className="text-white font-mono">
                      {outcome?.toUpperCase()}
                    </span>{" "}
                    will credit every winning share with 100⚡ and notify all
                    position holders.
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Back
                </Button>
                <Button onClick={submit} size="sm" disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Resolving…
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Resolve{" "}
                      {outcome?.toUpperCase()}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeButton({
  label,
  color,
  selected,
  onClick,
}: {
  label: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-md border-2 py-4 text-center font-bold text-lg transition-all",
        selected ? "scale-[1.02]" : "hover:scale-[1.01]",
      )}
      style={{
        borderColor: selected ? color : "#2A2F3D",
        color: selected ? color : "#8B92A8",
        background: selected ? `${color}14` : "transparent",
        boxShadow: selected ? `0 0 0 4px ${color}26` : undefined,
      }}
    >
      {label}
    </button>
  );
}
