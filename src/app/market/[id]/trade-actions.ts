"use server";

import { revalidatePath } from "next/cache";
import { executeTrade, type TradeRpcResult } from "@/lib/db/trades";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { ExecuteTradeInput, formatZodError } from "@/lib/validation";

export type ExecuteTradeResult =
  | { ok: true; result: TradeRpcResult }
  | { ok: false; error: string };

/**
 * Server-action wrapper for the atomic `execute_trade` RPC. The
 * underlying SQL function is SECURITY DEFINER and locks the profile
 * row, so concurrent buys cannot over-spend the user's balance.
 *
 * Callable from the BUY/SELL trade panel. The panel today drives
 * Zustand state for the prototype; once this action is wired the
 * panel can stop doing that and read the returned `new_balance` /
 * `new_shares` directly.
 */
export async function executeTradeAction(input: unknown): Promise<ExecuteTradeResult> {
  try {
    await requireUser();
    const parsed = ExecuteTradeInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const result = await executeTrade(parsed.data);
    revalidatePath(`/market/${parsed.data.marketId}`);
    revalidatePath("/profile/you");
    return { ok: true, result };
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
