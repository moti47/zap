"use server";

import { revalidatePath } from "next/cache";
import { updateMyProfile } from "@/lib/db/profiles";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { ProfilePatch, formatZodError } from "@/lib/validation";

export type { ProfilePatch } from "@/lib/validation";

/**
 * Server action invoked from the EditProfileModal. Persists allowed fields
 * on the caller's `profiles` row via `lib/db/profiles.updateMyProfile`
 * (RLS-scoped to the owner).
 */
export async function updateMyProfileAction(
  patch: unknown,
  opts?: { username?: string },
): Promise<{
  ok: boolean;
  profile?: Awaited<ReturnType<typeof updateMyProfile>>;
  error?: string;
}> {
  try {
    await requireUser();
    const parsed = ProfilePatch.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: formatZodError(parsed.error) };
    }
    const v = parsed.data;
    // Strip explicit-undefined keys so we don't overwrite existing
    // columns with null on a partial update.
    const cleaned: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) cleaned[k] = val;
    }
    const profile = await updateMyProfile(cleaned);

    if (opts?.username) revalidatePath(`/profile/${opts.username}`);
    revalidatePath("/profile");

    return { ok: true, profile };
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return { ok: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
