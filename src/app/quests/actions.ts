"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NotSignedInError } from "@/lib/auth";

const KIND_RE = /^[a-z][a-z0-9_]{0,40}$/;

function todayUtcKey(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function bumpQuestAction(input: {
  kind: string;
  delta?: number;
  day?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input || typeof input.kind !== "string" || !KIND_RE.test(input.kind)) {
    return { ok: false, error: "invalid_kind" };
  }
  const delta = Number.isFinite(input.delta) ? Math.max(0, Math.min(20, Math.floor(input.delta as number))) : 1;
  const day = typeof input.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.day)
    ? input.day
    : todayUtcKey();
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("bump_quest", {
      p_kind: input.kind,
      p_delta: delta,
      p_expected_day: day,
    });
    if (error) {
      if (error.code === "42501") throw new NotSignedInError();
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof NotSignedInError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function claimQuestAction(input: {
  kind: string;
  goal: number;
  reward: number;
  day?: string;
}): Promise<
  | { ok: true; newBalance: number }
  | { ok: false; error: string }
> {
  if (!input || typeof input.kind !== "string" || !KIND_RE.test(input.kind)) {
    return { ok: false, error: "invalid_kind" };
  }
  const goal = Math.max(1, Math.min(100, Math.floor(input.goal)));
  const reward = Math.max(1, Math.min(1000, Math.floor(input.reward)));
  const day = typeof input.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.day)
    ? input.day
    : todayUtcKey();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_quest_reward", {
      p_kind: input.kind,
      p_goal: goal,
      p_reward: reward,
      p_expected_day: day,
    });
    if (error) {
      if (error.code === "42501") throw new NotSignedInError();
      return { ok: false, error: error.message };
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { ok: boolean; reason?: string; new_balance?: number }
      | null;
    if (!row || !row.ok) {
      return { ok: false, error: row?.reason ?? "claim_failed" };
    }
    revalidatePath("/quests");
    return { ok: true, newBalance: Number(row.new_balance ?? 0) };
  } catch (err) {
    if (err instanceof NotSignedInError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function touchStreakAction(): Promise<
  | { ok: true; current: number; longest: number; credited: number; newBalance: number; alreadyToday: boolean }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("touch_streak", {});
    if (error) {
      if (error.code === "42501") throw new NotSignedInError();
      return { ok: false, error: error.message };
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          current: number;
          longest: number;
          credited: number;
          new_balance: number;
          already_today: boolean;
        }
      | null;
    if (!row) return { ok: false, error: "no_row" };
    return {
      ok: true,
      current: Number(row.current ?? 0),
      longest: Number(row.longest ?? 0),
      credited: Number(row.credited ?? 0),
      newBalance: Number(row.new_balance ?? 0),
      alreadyToday: !!row.already_today,
    };
  } catch (err) {
    if (err instanceof NotSignedInError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
