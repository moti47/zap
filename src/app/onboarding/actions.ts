"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Persist onboarding selections to the user's profile:
 *   - profiles.onboarded = true
 *   - profiles.affinity merges per-category bias (0.7 for picked, 0.3 default)
 */
export async function completeOnboardingAction(input: {
  categories: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in" };

    const cats = Array.from(
      new Set(
        (input.categories || [])
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    const affinity: Record<string, number> = {};
    for (const c of cats) affinity[c] = 0.7;

    // Merge with existing affinity so we don't clobber organic signals.
    const { data: existing } = await supabase
      .from("profiles")
      .select("affinity")
      .eq("id", user.id)
      .maybeSingle();
    const merged: Record<string, number> = {
      ...((existing?.affinity as Record<string, number>) ?? {}),
      ...affinity,
    };

    const { error } = await supabase
      .from("profiles")
      .update({ onboarded: true, affinity: merged })
      .eq("id", user.id);
    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/profile/you");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
