"use client";

/**
 * Right sidebar — Phase 11+ slim version.
 *
 * Per user request, the sidebar surfaces only the two retention
 * mechanics: the daily streak and the day's quests. The previous
 * Zap Pulse / Trending Topics / Trending Markets / Top Experts /
 * Suggested Follows / Live Activity panels were removed.
 *
 * They still live inside the codebase if needed later (the Markets /
 * Leaderboard / Saved / Quests pages cover the same surfaces in
 * dedicated views). Keeping this file isolated to the two cards
 * also lets the streak + quests breathe at full width.
 */

import { StreakCard } from "./streak-card";
import { QuestsCard } from "./quests-card";

export function RightSidebar() {
  return (
    <aside
      aria-label="Sidebar"
      className="hidden xl:flex flex-col gap-4 w-[320px] shrink-0 sticky top-[4.5rem] self-start max-h-[calc(100vh-5rem)] overflow-y-auto thin-scrollbar pr-1"
    >
      <StreakCard />
      <QuestsCard />
    </aside>
  );
}
