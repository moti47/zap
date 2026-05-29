import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Production leaderboard data source. Pulls the top profiles from
 * Supabase along with their expert_scores aggregated per category.
 *
 * Returns a `LeaderboardRow[]` shaped close enough to the fixture
 * `User` type that the existing client component renders without
 * structural changes.
 */
export interface LeaderboardRow {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  primaryCategory: string;
  expertScores: Record<string, number>;
  brierScores: Record<string, number>;
  totalPredictions: number;
  pointsWon: number;
}

const TOP_N = 50;

export async function listLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();

  // Pull the top N profiles by zaps; the leaderboard sort happens
  // client-side per category so this gives us a single SQL trip.
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select(
      "id, username, name, avatar_url, zaps, total_predictions",
    )
    .order("zaps", { ascending: false })
    .limit(TOP_N);
  if (pErr || !profiles) return [];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: scores } = await supabase
    .from("expert_scores")
    .select("user_id, category_id, brier, percentile, volume, calibration")
    .in("user_id", ids);

  const { data: cats } = await supabase
    .from("categories")
    .select("id, slug");
  const slugById = new Map<string, string>(
    (cats ?? []).map((c) => [c.id as string, c.slug as string]),
  );

  // Group score rows by user → { slug: percentile } / { slug: brier }.
  const expertByUser = new Map<string, Record<string, number>>();
  const brierByUser = new Map<string, Record<string, number>>();
  const topCatByUser = new Map<string, { slug: string; score: number }>();
  for (const s of scores ?? []) {
    const slug = slugById.get(s.category_id as string);
    if (!slug) continue;
    const ex = expertByUser.get(s.user_id as string) ?? {};
    const br = brierByUser.get(s.user_id as string) ?? {};
    ex[slug] = Number(s.percentile ?? 0);
    br[slug] = Number(s.brier ?? 0);
    expertByUser.set(s.user_id as string, ex);
    brierByUser.set(s.user_id as string, br);

    const prev = topCatByUser.get(s.user_id as string);
    if (!prev || (s.percentile as number) > prev.score) {
      topCatByUser.set(s.user_id as string, {
        slug,
        score: Number(s.percentile ?? 0),
      });
    }
  }

  return profiles.map((p) => ({
    id: p.id as string,
    username: p.username as string,
    name: (p.name as string) ?? (p.username as string),
    avatarUrl: (p.avatar_url as string | null) ?? null,
    primaryCategory: topCatByUser.get(p.id as string)?.slug ?? "general",
    expertScores: expertByUser.get(p.id as string) ?? {},
    brierScores: brierByUser.get(p.id as string) ?? {},
    totalPredictions: Number(p.total_predictions ?? 0),
    pointsWon: Number(p.zaps ?? 0),
  }));
}
