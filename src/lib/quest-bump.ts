"use client";

import { bumpQuestAction } from "@/app/quests/actions";

/**
 * Fire-and-forget server bump so daily quest progress survives page
 * reloads. Errors are swallowed — the local Zustand mirror is what
 * the UI renders, so a network blip just means the row doesn't sync
 * this tick. The server side is idempotent against the day key.
 */
export function fireBumpQuest(kind: string, delta = 1): void {
  if (!kind || delta <= 0) return;
  void bumpQuestAction({ kind, delta }).catch(() => {
    // Intentionally silent.
  });
}
