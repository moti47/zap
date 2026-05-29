"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
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
