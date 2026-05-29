"use client";

import { useEffect, useRef } from "react";
import { useViewer } from "@/lib/use-viewer";
import { useZapStore } from "@/lib/store";

/**
 * Polish 5 — server → Zustand hydration bridge.
 *
 * Without this, every page reload picks fresh daily quests (Zustand
 * has no persist since Phase 10) and the streak resets to 0 because
 * `FRESH_STREAK` is the static initial value. The user kept saying
 * "quests reset every visit, streak never sticks" — they're right.
 *
 * Now: as soon as `useViewer` resolves a signed-in profile we copy
 * `quest_day / quest_progress / quest_claimed / streak_*` into the
 * Zustand mirror via `hydrateFromServer`. The Zustand mirror is what
 * QuestsCard, StreakCard, and the composer's quest bumps render
 * against; the server stays the source of truth.
 *
 * Mounted once at the top of the app shell.
 */
export function ViewerBoot() {
  const { viewer } = useViewer();
  const hydrate = useZapStore((s) => s.hydrateFromServer);
  const seededForId = useRef<string | null>(null);
  const lastZaps = useRef<number | null>(null);

  useEffect(() => {
    if (!viewer) return;
    const freshUser = seededForId.current !== viewer.id;
    if (freshUser) {
      seededForId.current = viewer.id;
      lastZaps.current = viewer.zaps;
      hydrate({
        zaps: viewer.zaps,
        questDay: viewer.quest_day ?? null,
        questProgress: viewer.quest_progress ?? {},
        questClaimed: viewer.quest_claimed ?? {},
        streakCurrent: viewer.streak_current ?? 0,
        streakLongest: viewer.streak_longest ?? 0,
        streakLastCheckIn: viewer.streak_last_check_in ?? null,
      });
      return;
    }
    // Polish 6 — re-sync `points` whenever viewer.zaps changes (e.g. a
    // trade reduced the balance, a quest claim added to it). Without
    // this the Zustand mirror would drift from the real balance any
    // time the realtime channel updated profiles.zaps.
    if (lastZaps.current !== viewer.zaps) {
      lastZaps.current = viewer.zaps;
      hydrate({ zaps: viewer.zaps });
    }
  }, [viewer, hydrate]);

  return null;
}
