import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fanoutNotifications } from "@/lib/db/notifications";
import type {
  MarketRow,
  PositionRow,
  ProfileRow,
} from "@/lib/supabase/types";

export interface ResolveResult {
  ok: boolean;
  market?: MarketRow;
  settledPositions: number;
  totalPayout: number;
  notified: number;
  error?: string;
}

/**
 * Resolve a market YES/NO. Server-side only; verifies the caller created
 * the market, then uses the service-role client to:
 *
 *   1. Flip `markets.status = 'resolved'` + set `outcome`.
 *   2. Pay 100⚡ per share to every winning position. Losing positions
 *      keep their staked Zaps locked (they bought at < 100, so the loss
 *      already happened at trade time — no further deduction).
 *   3. Insert a synthetic `sell` trade row at 100⚡ for each winning
 *      position so trade history reflects the payout.
 *   4. Delete settled position rows (positions table is fully replaced
 *      by the trade ledger after resolution).
 *   5. Fan out `market_resolved` notifications to all position holders.
 *
 * Idempotent against re-resolution attempts — bails when the market is
 * already resolved.
 */
export async function resolveMarket(
  marketId: string,
  outcome: "yes" | "no",
): Promise<ResolveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      settledPositions: 0,
      totalPayout: 0,
      notified: 0,
      error: "Not signed in",
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      settledPositions: 0,
      totalPayout: 0,
      notified: 0,
      error: "Service role key not configured",
    };
  }

  const service = createServiceClient();
  const { data: market } = await service
    .from("markets")
    .select("*")
    .eq("id", marketId)
    .maybeSingle();

  if (!market) {
    return {
      ok: false,
      settledPositions: 0,
      totalPayout: 0,
      notified: 0,
      error: "Market not found",
    };
  }
  if (market.created_by && market.created_by !== user.id) {
    return {
      ok: false,
      settledPositions: 0,
      totalPayout: 0,
      notified: 0,
      error: "Only the market creator can resolve this market",
    };
  }
  if (market.status === "resolved") {
    return {
      ok: false,
      settledPositions: 0,
      totalPayout: 0,
      notified: 0,
      error: "Market is already resolved",
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await service
    .from("markets")
    .update({
      status: "resolved",
      outcome,
      yes_price: outcome === "yes" ? 100 : 0,
      no_price: outcome === "yes" ? 0 : 100,
    })
    .eq("id", marketId)
    .select()
    .single();
  if (updateErr || !updated) {
    return {
      ok: false,
      settledPositions: 0,
      totalPayout: 0,
      notified: 0,
      error: updateErr?.message ?? "Failed to flip market status",
    };
  }

  // Pull every position on this market.
  const { data: positions } = await service
    .from("positions")
    .select("*")
    .eq("market_id", marketId);

  let totalPayout = 0;
  let settled = 0;
  const winners = (positions ?? []).filter((p) => p.side === outcome);
  const losers = (positions ?? []).filter((p) => p.side !== outcome);

  // Group winners by user so we credit a single Zap update per user.
  const payoutByUser = new Map<string, number>();
  for (const w of winners as PositionRow[]) {
    const payout = w.shares * 100;
    totalPayout += payout;
    settled++;
    payoutByUser.set(
      w.user_id,
      (payoutByUser.get(w.user_id) ?? 0) + payout,
    );
  }

  // Credit Zaps in parallel; service-role bypasses RLS.
  if (payoutByUser.size > 0) {
    const { data: payeeProfiles } = await service
      .from("profiles")
      .select("id, zaps")
      .in("id", [...payoutByUser.keys()]);
    for (const p of (payeeProfiles ?? []) as Pick<ProfileRow, "id" | "zaps">[]) {
      const delta = payoutByUser.get(p.id) ?? 0;
      if (delta > 0) {
        await service
          .from("profiles")
          .update({ zaps: p.zaps + delta })
          .eq("id", p.id);
      }
    }
  }

  // Record synthetic sell trades for winning positions at 100⚡.
  if (winners.length > 0) {
    await service.from("trades").insert(
      (winners as PositionRow[]).map((w) => ({
        user_id: w.user_id,
        market_id: marketId,
        side: outcome,
        action: "sell" as const,
        shares: w.shares,
        price: 100,
        created_at: now,
      })),
    );
  }

  // Wipe positions — the ledger now lives only in `trades`.
  if ((positions ?? []).length > 0) {
    await service.from("positions").delete().eq("market_id", marketId);
  }

  // Fan out notifications to anyone who held a position.
  const holderIds = Array.from(
    new Set((positions ?? []).map((p) => p.user_id)),
  );
  await fanoutNotifications({
    recipientIds: holderIds,
    type: "market_resolved",
    payload: {
      market_id: marketId,
      outcome,
      title: `Market resolved ${outcome.toUpperCase()}`,
      body: market.question,
      href: `/market/${marketId}`,
    },
    actorId: user.id,
  });

  return {
    ok: true,
    market: updated as MarketRow,
    settledPositions: settled + losers.length,
    totalPayout,
    notified: holderIds.length,
  };
}
