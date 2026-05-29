import { notFound } from "next/navigation";
import { getMarket, markets } from "@/lib/fixtures";
import { MarketDetailClient } from "./market-detail-client";
import {
  getMarket as getMarketRow,
  type MarketWithCategory,
} from "@/lib/db/markets";
import { getCurrentProfile } from "@/lib/db/profiles";
import type { Market } from "@/lib/fixtures";

export function generateStaticParams() {
  return markets.map((m) => ({ id: m.id }));
}

export const dynamic = "force-dynamic";

/**
 * Round-2 fix — Supabase-created markets weren't in `lib/fixtures`,
 * which made every real market id 404 ("Lost in Space"). Adapt the DB
 * row into the fixture-shaped `Market` so MarketDetailClient renders
 * identically for both sources of truth.
 */
function dbRowToMarket(row: MarketWithCategory): Market {
  const yes = Math.round(Number(row.yes_price ?? 50));
  const no = Math.round(Number(row.no_price ?? 100 - yes));
  return {
    id: String(row.id),
    question: row.question,
    description: row.description ?? "",
    category: (row.category?.slug as Market["category"]) ?? "general",
    resolutionDate: row.resolution_date,
    resolutionSource: row.resolution_source ?? "",
    createdAt: row.created_at,
    currentYesPrice: yes,
    currentNoPrice: no,
    volume24h: Math.round(Number(row.total_volume ?? 0) * 0.18),
    totalVolume: Number(row.total_volume ?? 0),
    traders: 0,
    priceHistory: [
      // Minimal flat history so the chart renders without breaking;
      // real history is filled in by realtime trades after first load.
      { timestamp: row.created_at, yesPrice: yes },
      { timestamp: new Date().toISOString(), yesPrice: yes },
    ],
    topHolders: { yes: [], no: [] },
    imageUrl: row.hero_image_url ?? undefined,
  };
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Look up in both data sources in parallel. Either is enough to
  // render — the page used to 404 on DB-only markets because it only
  // checked the fixture map.
  let market = getMarket(id);
  let dbRow: MarketWithCategory | null = null;
  let me: Awaited<ReturnType<typeof getCurrentProfile>> = null;
  try {
    const [row, profile] = await Promise.all([
      getMarketRow(id),
      getCurrentProfile(),
    ]);
    dbRow = row;
    me = profile;
  } catch {
    // Supabase env may be absent — fixture-only path still works.
  }

  if (!market && dbRow) {
    market = dbRowToMarket(dbRow);
  }

  if (!market) notFound();

  const dbStatus: "open" | "resolved" | "cancelled" | null =
    dbRow?.status ?? null;
  const dbOutcome: "yes" | "no" | null = dbRow?.outcome ?? null;
  const canResolve = !!(
    me &&
    dbRow &&
    dbRow.created_by &&
    dbRow.created_by === me.id &&
    dbRow.status === "open"
  );

  return (
    <MarketDetailClient
      market={market}
      canResolve={canResolve}
      dbStatus={dbStatus}
      dbOutcome={dbOutcome}
    />
  );
}
