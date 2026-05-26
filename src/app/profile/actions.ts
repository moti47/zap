"use server";

import { revalidatePath } from "next/cache";
import { updateMyProfile } from "@/lib/db/profiles";
import { requireUser, NotSignedInError } from "@/lib/auth";

export interface ProfilePatch {
  name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  cover_gradient?: string | null;
  banner_url?: string | null;
}

/**
 * Server action invoked from the EditProfileModal. Persists allowed fields
 * on the caller's `profiles` row via `lib/db/profiles.updateMyProfile`
 * (RLS-scoped to the owner).
 */
export async function updateMyProfileAction(
  patch: ProfilePatch,
  opts?: { username?: string },
): Promise<{
  ok: boolean;
  profile?: Awaited<ReturnType<typeof updateMyProfile>>;
  error?: string;
}> {
  try {
    await requireUser();
    const cleaned: ProfilePatch = {};
    if (typeof patch.name === "string") {
      const trimmed = patch.name.trim().slice(0, 50);
      if (!trimmed) return { ok: false, error: "Name required" };
      cleaned.name = trimmed;
    }
    if (patch.bio !== undefined) {
      cleaned.bio =
        patch.bio == null ? null : String(patch.bio).slice(0, 280);
    }
    if (patch.avatar_url !== undefined) {
      cleaned.avatar_url = patch.avatar_url || null;
    }
    if (patch.cover_gradient !== undefined) {
      cleaned.cover_gradient = patch.cover_gradient || null;
    }
    if (patch.banner_url !== undefined) {
      cleaned.banner_url = patch.banner_url || null;
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
