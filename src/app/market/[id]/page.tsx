import { notFound } from "next/navigation";
import { getMarket, markets } from "@/lib/fixtures";
import { MarketDetailClient } from "./market-detail-client";
import { getMarket as getMarketRow } from "@/lib/db/markets";
import { getCurrentProfile } from "@/lib/db/profiles";

export function generateStaticParams() {
  return markets.map((m) => ({ id: m.id }));
}

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = getMarket(id);
  if (!market) notFound();

  // Resolution permissions: only the Supabase market creator can resolve.
  let canResolve = false;
  let dbStatus: "open" | "resolved" | "cancelled" | null = null;
  let dbOutcome: "yes" | "no" | null = null;
  try {
    const [row, me] = await Promise.all([
      getMarketRow(id),
      getCurrentProfile(),
    ]);
    if (row) {
      dbStatus = row.status;
      dbOutcome = row.outcome ?? null;
      if (
        me &&
        row.created_by &&
        row.created_by === me.id &&
        row.status === "open"
      ) {
        canResolve = true;
      }
    }
  } catch {
    canResolve = false;
  }

  return (
    <MarketDetailClient
      market={market}
      canResolve={canResolve}
      dbStatus={dbStatus}
      dbOutcome={dbOutcome}
    />
  );
}
