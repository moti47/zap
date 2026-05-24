import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Side } from "@/lib/supabase/types";

/**
 * Atomically: deduct Zaps, write trade row, upsert position, bump market
 * price + volume. RLS lets the user write only their own positions row;
 * the markets table is service-role write-only, so we update yes/no price
 * via a Postgres function (added in a later migration) — for Phase 1 we
 * still update through the user client for prototyping.
 */
export async function executeTrade(input: {
  marketId: string;
  side: Side;
  action: "buy" | "sell";
  shares: number;
  price: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const cost = Math.round((input.shares * input.price) / 100);

  if (input.action === "buy") {
    // Check balance.
    const { data: profile } = await supabase
      .from("profiles")
      .select("zaps, total_predictions")
      .eq("id", user.id)
      .single();
    if (!profile || profile.zaps < cost) {
      throw new Error("Not enough Zaps");
    }
    await supabase
      .from("profiles")
      .update({
        zaps: profile.zaps - cost,
        total_predictions: profile.total_predictions + 1,
      })
      .eq("id", user.id);

    // Upsert position.
    const { data: existing } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("market_id", input.marketId)
      .eq("side", input.side)
      .maybeSingle();

    if (existing) {
      const totalShares = existing.shares + input.shares;
      const newAvg =
        (existing.avg_price * existing.shares + input.price * input.shares) /
        totalShares;
      await supabase
        .from("positions")
        .update({ shares: totalShares, avg_price: newAvg })
        .eq("id", existing.id);
    } else {
      await supabase.from("positions").insert({
        user_id: user.id,
        market_id: input.marketId,
        side: input.side,
        shares: input.shares,
        avg_price: input.price,
      });
    }
  } else {
    // Sell.
    const { data: existing } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("market_id", input.marketId)
      .eq("side", input.side)
      .maybeSingle();
    if (!existing || existing.shares < input.shares) {
      throw new Error("Not enough shares to sell");
    }
    const proceeds = Math.round((input.shares * input.price) / 100);
    const { data: profile } = await supabase
      .from("profiles")
      .select("zaps")
      .eq("id", user.id)
      .single();
    await supabase
      .from("profiles")
      .update({ zaps: (profile?.zaps ?? 0) + proceeds })
      .eq("id", user.id);

    const remaining = existing.shares - input.shares;
    if (remaining === 0) {
      await supabase.from("positions").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("positions")
        .update({ shares: remaining })
        .eq("id", existing.id);
    }
  }

  // Record the trade. RLS lets the user insert their own row.
  await supabase.from("trades").insert({
    user_id: user.id,
    market_id: input.marketId,
    side: input.side,
    action: input.action,
    shares: input.shares,
    price: input.price,
  });

  return { ok: true };
}

export async function getMyPositions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("positions")
    .select("*, market:markets(id, question, yes_price, no_price, status, outcome)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}
