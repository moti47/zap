import "server-only";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Section 26 — admin market creation.
 *
 * Only callable by the configured admin. Bypasses the RLS user policy
 * via the service-role client and seeds liquidity in the same insert.
 */
export interface AdminCreateMarketInput {
  question: string;
  description: string;
  category_id: string;
  resolution_date: string; // ISO
  resolution_source: string;
  initial_yes_price: number; // 1..99
  hero_image_url?: string | null;
  seed_liquidity?: number;   // Zaps to seed; informational only for the prototype
}

export async function adminCreateMarket(input: AdminCreateMarketInput) {
  await requireAdmin();
  const svc = createServiceClient();

  const yes = clampInt(input.initial_yes_price, 1, 99);
  const { data, error } = await svc
    .from("markets")
    .insert({
      question: input.question.trim(),
      description: input.description.trim(),
      category_id: input.category_id,
      resolution_date: input.resolution_date,
      resolution_source: input.resolution_source.trim(),
      yes_price: yes,
      no_price: 100 - yes,
      hero_image_url: input.hero_image_url ?? null,
      total_volume: input.seed_liquidity ?? 0,
      creation_source: "admin",
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
