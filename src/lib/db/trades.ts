import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Side, TradeAction } from "@/lib/supabase/types";
import { NotSignedInError } from "@/lib/auth";

/**
 * Atomic trade execution via the `execute_trade` SQL function added in
 * migration 0008. One transaction handles: balance check (with
 * `for update` row lock), Zaps debit/credit, position upsert, trade
 * ledger insert, market price + volume bump. Concurrent trades cannot
 * over-spend the user's balance.
 *
 * Returns the new balance + new position size + new avg price.
 */
export interface TradeRpcResult {
  new_balance: number;
  new_shares: number;
  new_avg_price: number;
}

export async function executeTrade(input: {
  marketId: string;
  side: Side;
  action: TradeAction;
  shares: number;
  price: number;
}): Promise<TradeRpcResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("execute_trade", {
    p_market_id: input.marketId,
    p_side: input.side,
    p_action: input.action,
    p_shares: Math.floor(input.shares),
    p_price: input.price,
  });
  if (error) {
    if (error.code === "42501") throw new NotSignedInError();
    throw error;
  }
  // `rpc` with a `returns table` returns an array; take the first row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Trade RPC returned no row");
  return row as TradeRpcResult;
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
