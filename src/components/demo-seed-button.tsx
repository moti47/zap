"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useZapStore } from "@/lib/store";
import { markets, users, generateTrades } from "@/lib/fixtures";

export function DemoSeedButton() {
  const tickPrice = useZapStore((s) => s.tickPrice);
  const pushLiveTrade = useZapStore((s) => s.pushLiveTrade);
  const addPost = useZapStore((s) => s.addPost);
  const [running, setRunning] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  const runSeed = async () => {
    setRunning(true);
    const trades = generateTrades(5).map((t) => ({ ...t, isMine: false }));
    for (let i = 0; i < trades.length; i++) {
      const t = trades[i];
      await new Promise((r) => setTimeout(r, 750));
      pushLiveTrade(t);
      const delta = Math.floor(Math.random() * 3) + 1;
      tickPrice(t.marketId, t.side, delta);
      const user = users.find((u) => u.id === t.userId);
      toast(`${user?.name ?? "Anon"} ${t.side === "YES" ? "bought" : "sold"} ${t.shares} ${t.side} @ ${t.price}¢`, {
        description: `Live on Zap`,
      });
    }
    const m = markets[Math.floor(Math.random() * markets.length)];
    addPost({
      body:
        "Just posted live. Take a look at this market — feeling strong conviction on this one.",
      category: m.category,
      marketId: m.id,
    });
    setRunning(false);
  };

  return (
    <Button
      onClick={runSeed}
      disabled={running}
      variant="secondary"
      size="sm"
      className="fixed bottom-20 right-4 lg:bottom-4 lg:right-4 z-50 shadow-2xl border border-[#FFE600]/40 bg-[#1A1D26]"
    >
      <Zap className="h-4 w-4 text-[#FFE600]" />
      {running ? "Seeding…" : "Demo seed"}
    </Button>
  );
}
