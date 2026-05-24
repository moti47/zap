"use client";

import { useRef, useState } from "react";
import { Share2, Download, Loader2, Copy } from "lucide-react";
import { toPng, toBlob } from "html-to-image";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { ZapLogo, ZapMark } from "../zap-logo";
import { CategoryTag } from "../expert-badge";
import { Sparkline } from "./sparkline";
import { useZapStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { Market } from "@/lib/mock-data";
import { formatLargeNumber } from "@/lib/utils";

interface ShareCardButtonProps {
  market: Market;
}

export function ShareCardButton({ market }: ShareCardButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const positions = useZapStore(useShallow((s) => s.positions));
  const live = useZapStore((s) => s.marketPrices[market.id]);
  const yesPrice = live?.yes ?? market.currentYesPrice;
  const noPrice = live?.no ?? market.currentNoPrice;
  const myPosition = positions.find((p) => p.marketId === market.id);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (!cardRef.current) return;
    setCopying(true);
    try {
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0A0B0F",
      });
      if (blob && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Copied to clipboard", { description: "Paste anywhere." });
      } else {
        toast.error("Clipboard not available", { description: "Use Download instead." });
      }
    } catch {
      toast.error("Couldn't copy image");
    } finally {
      setCopying(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0A0B0F",
      });
      const link = document.createElement("a");
      link.download = `zap-prediction-${market.id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Card saved", { description: "Ready to share on X / socials." });
    } catch {
      toast.error("Couldn't save image");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Share your prediction</DialogTitle>
          <DialogDescription>
            Download a card with this market and your position to share on X.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg overflow-hidden border border-[#2A2F3D]">
          <div ref={cardRef} className="w-[640px] h-[360px] relative" style={{ background: "#0A0B0F" }}>
            {/* Glows */}
            <div
              className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,230,0,0.18), transparent 60%)",
              }}
            />
            <div
              className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(0,217,130,0.10), transparent 60%)",
              }}
            />

            <div className="relative p-8 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <ZapLogo size="md" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#5A6175]">
                  predict.zap
                </span>
              </div>

              <div className="mt-4">
                <CategoryTag category={market.category} />
                <h3 className="mt-2 text-[24px] font-bold leading-tight tracking-tight text-white">
                  {market.question}
                </h3>
              </div>

              <div className="mt-auto">
                <div className="flex items-end gap-6">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
                      YES
                    </div>
                    <div className="text-4xl font-bold font-mono text-[#00D982] inline-flex items-baseline">
                      {yesPrice}
                      <span className="text-base ml-0.5">⚡</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
                      NO
                    </div>
                    <div className="text-4xl font-bold font-mono text-[#FF4757] inline-flex items-baseline">
                      {noPrice}
                      <span className="text-base ml-0.5">⚡</span>
                    </div>
                  </div>
                  <div className="ml-auto opacity-80">
                    <Sparkline
                      data={market.priceHistory.slice(-30)}
                      positive={yesPrice > 50}
                      width={140}
                      height={48}
                    />
                  </div>
                </div>

                {myPosition && (
                  <div
                    className="mt-4 inline-block px-3 py-2 rounded-md border-2 font-mono text-[13px]"
                    style={{
                      borderColor: myPosition.side === "YES" ? "#00D982" : "#FF4757",
                      color: myPosition.side === "YES" ? "#00D982" : "#FF4757",
                      background:
                        myPosition.side === "YES"
                          ? "rgba(0,217,130,0.10)"
                          : "rgba(255,71,87,0.10)",
                    }}
                  >
                    {myPosition.side === "YES" ? "▲" : "▼"} I'm holding {myPosition.shares}{" "}
                    {myPosition.side} @ {myPosition.avgPrice}⚡
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[#2A2F3D] flex items-center justify-between text-[11px] font-mono text-[#5A6175]">
                  <span>
                    Volume{" "}
                    <span className="text-white font-bold">
                      {formatLargeNumber(market.totalVolume)}⚡
                    </span>{" "}
                    · {market.traders.toLocaleString()} traders
                  </span>
                  <span className="text-[#FFE600] font-bold">⚡ zap.app</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 flex-wrap">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button variant="secondary" onClick={handleCopy} disabled={copying}>
            {copying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy to clipboard
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
