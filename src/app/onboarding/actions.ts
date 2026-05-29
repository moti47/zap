"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { OnboardingInput, formatZodError } from "@/lib/validation";

/**
 * Persist onboarding selections to the user's profile:
 *   - profiles.onboarded = true
 *   - profiles.affinity merges per-category bias (0.7 for picked, 0.3 default)
 *
 * The `affinity` column is a flat `{slug: weight}` jsonb. We merge into
 * any existing shape so we don't clobber organic signals from likes /
 * impressions. If a row has been migrated to a nested
 * `{categories: {...}}` shape, the nested keys are preserved untouched.
 */
export async function completeOnboardingAction(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const parsed = OnboardingInput.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: formatZodError(parsed.error) };
    }
    const cats = Array.from(new Set(parsed.data.categories));
    const affinity: Record<string, number> = {};
    for (const c of cats) affinity[c] = 0.7;

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("affinity")
      .eq("id", user.id)
      .maybeSingle();

    const prev = (existing?.affinity ?? {}) as Record<string, unknown>;
    // Detect nested-shape rows ({categories: {...}, hashtags: {...}}).
    // Merge the new flat keys into prev.categories when present, otherwise
    // merge at the top level. Either way, we never drop existing data.
    let merged: Record<string, unknown>;
    if (
      prev &&
      typeof prev === "object" &&
      "categories" in prev &&
      typeof prev.categories === "object" &&
      prev.categories !== null
    ) {
      merged = {
        ...prev,
        categories: {
          ...(prev.categories as Record<string, number>),
          ...affinity,
        },
      };
    } else {
      merged = { ...prev, ...affinity };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ onboarded: true, affinity: merged })
      .eq("id", user.id);
    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/profile/you");
    return { ok: true };
  } catch (err) {
    if (err instanceof NotSignedInError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
