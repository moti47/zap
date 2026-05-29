"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminUpdateUser,
  type AdminRole,
  type UpdateUserPatch,
} from "@/lib/db/admin-users";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateUserAction(
  userId: string,
  patch: UpdateUserPatch,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!userId) return { ok: false, error: "userId is required" };
    // Re-validate role enum on the server boundary.
    if (
      patch.role !== undefined &&
      patch.role !== "user" &&
      patch.role !== "moderator" &&
      patch.role !== "admin"
    ) {
      return { ok: false, error: "Invalid role" };
    }
    if (
      patch.zaps !== undefined &&
      (!Number.isFinite(patch.zaps) || patch.zaps < 0)
    ) {
      return { ok: false, error: "Zaps must be a non-negative number" };
    }
    await adminUpdateUser(userId, patch);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function setUserRoleAction(
  userId: string,
  role: AdminRole,
): Promise<ActionResult> {
  return updateUserAction(userId, { role });
}

export async function setUserSuspendedAction(
  userId: string,
  suspended: boolean,
): Promise<ActionResult> {
  return updateUserAction(userId, { is_suspended: suspended });
}

export async function setUserZapsAction(
  userId: string,
  zaps: number,
): Promise<ActionResult> {
  return updateUserAction(userId, { zaps });
}

/**
 * Polish 5 — recompute a single user's expertise across every category
 * they hold resolved positions in. Hits the `recompute_user_expertise`
 * RPC (migration 0012). Returns the number of (user, category) rows
 * touched so the UI can display useful feedback.
 */
export async function recomputeUserExpertiseAction(
  userId: string,
): Promise<{ ok: true; touched: number } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    if (!userId) return { ok: false, error: "userId is required" };
    const svc = createServiceClient();
    const { data, error } = await svc.rpc("recompute_user_expertise", {
      p_user_id: userId,
    });
    if (error) return { ok: false, error: error.message };
    const touched = Array.isArray(data)
      ? Number((data[0] as any) ?? 0)
      : Number(data ?? 0);
    revalidatePath("/admin/users");
    revalidatePath(`/profile/${userId}`);
    return { ok: true, touched: Number.isFinite(touched) ? touched : 0 };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
