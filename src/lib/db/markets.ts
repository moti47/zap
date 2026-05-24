import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MarketRow, Side } from "@/lib/supabase/types";

export type MarketWithCategory = MarketRow & {
  category: { slug: string; name: string; color: string };
};

export async function listMarkets(opts?: {
  categorySlug?: string;
  status?: "open" | "resolved" | "cancelled";
  sort?: "trending" | "newest" | "closing" | "volume";
  limit?: number;
  search?: string;
}): Promise<MarketWithCategory[]> {
  const supabase = await createClient();
  let q = supabase
    .from("markets")
    .select("*, category:categories!inner(slug, name, color)")
    .eq("status", opts?.status ?? "open")
    .limit(opts?.limit ?? 50);

  if (opts?.categorySlug) q = q.eq("category.slug", opts.categorySlug);
  if (opts?.search) q = q.ilike("question", `%${opts.search}%`);

  switch (opts?.sort ?? "trending") {
    case "newest":
      q = q.order("created_at", { ascending: false });
      break;
    case "closing":
      q = q.order("resolution_date", { ascending: true });
      break;
    case "volume":
    case "trending":
    default:
      q = q.order("total_volume", { ascending: false });
      break;
  }

  const { data } = await q;
  return (data ?? []) as MarketWithCategory[];
}

export async function getMarket(id: string): Promise<MarketWithCategory | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*, category:categories!inner(slug, name, color)")
    .eq("id", id)
    .maybeSingle();
  return (data as MarketWithCategory | null) ?? null;
}

export async function getMyPosition(marketId: string, side: Side) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", user.id)
    .eq("market_id", marketId)
    .eq("side", side)
    .maybeSingle();
  return data;
}

export async function listRecentTrades(marketId?: string, limit = 30) {
  const supabase = await createClient();
  let q = supabase
    .from("trades")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (marketId) q = q.eq("market_id", marketId);
  const { data } = await q;
  return data ?? [];
}
