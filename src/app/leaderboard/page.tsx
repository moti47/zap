import { LeaderboardClient } from "./leaderboard-client";
import { listLeaderboard } from "@/lib/db/leaderboard";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // Real data first. Fixtures only when there's no backend, or when
  // the demo flag is explicitly enabled (preview environments).
  const rows = isDemoMode() ? [] : await listLeaderboard();
  return <LeaderboardClient initialRows={rows} />;
}
