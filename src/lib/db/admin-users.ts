import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";

/**
 * Item #6 — granular admin user management.
 *
 * The list and mutation helpers below are gated by `requireAdmin()` at
 * the entry point. Mutations use the service-role client because the
 * default RLS policies block `profiles` writes to anyone other than the
 * owning user. Auditable by the caller: every action returns the
 * updated row.
 */

export interface AdminUserRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  zaps: number;
  role: "user" | "moderator" | "admin";
  is_admin: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string | null;
  last_tracked_login: string | null;
}

export type AdminRole = "user" | "moderator" | "admin";

function rowToAdminUser(
  row: Record<string, unknown>,
  email: string | null,
): AdminUserRow {
  return {
    id: String(row.id ?? ""),
    username: String(row.username ?? ""),
    name: String(row.name ?? row.username ?? ""),
    email,
    avatar_url: (row.avatar_url as string | null) ?? null,
    zaps: Number(row.zaps ?? 0),
    role:
      (row.role as AdminRole | undefined) ??
      (row.is_admin ? "admin" : "user"),
    is_admin: Boolean(row.is_admin),
    is_suspended: Boolean(row.is_suspended),
    created_at: String(row.created_at ?? ""),
    updated_at: (row.updated_at as string | null) ?? null,
    last_tracked_login: (row.last_tracked_login as string | null) ?? null,
  };
}

export async function listAllUsersForAdmin(
  search = "",
  limit = 200,
): Promise<AdminUserRow[]> {
  await requireAdmin();
  const supabase = createServiceClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, username, name, avatar_url, zaps, role, is_admin, is_suspended, created_at, updated_at, last_tracked_login",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (search.trim().length > 0) {
    const q = search.trim();
    query = query.or(`username.ilike.%${q}%,name.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;

  // Best-effort email lookup via admin auth API. Falls back silently
  // because not every environment grants the service role auth list.
  const emailsById = new Map<string, string | null>();
  try {
    const { data: usersList } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of usersList?.users ?? []) {
      emailsById.set(u.id, u.email ?? null);
    }
  } catch {
    // service role can't reach auth API in this env — leave emails null.
  }

  return (data ?? []).map((row) =>
    rowToAdminUser(row, emailsById.get(String(row.id)) ?? null),
  );
}

export interface UpdateUserPatch {
  zaps?: number;
  role?: AdminRole;
  is_suspended?: boolean;
}

export async function adminUpdateUser(
  userId: string,
  patch: UpdateUserPatch,
): Promise<AdminUserRow> {
  await requireAdmin();
  if (!userId || typeof userId !== "string") {
    throw new Error("userId is required");
  }
  const supabase = createServiceClient();

  // Build the update payload defensively. `is_admin` is derived from
  // role to keep the two columns coherent — flipping role=admin also
  // sets is_admin=true.
  const update: Record<string, unknown> = {};
  if (typeof patch.zaps === "number" && Number.isFinite(patch.zaps)) {
    update.zaps = Math.max(0, Math.floor(patch.zaps));
  }
  if (
    patch.role === "user" ||
    patch.role === "moderator" ||
    patch.role === "admin"
  ) {
    update.role = patch.role;
    update.is_admin = patch.role === "admin";
  }
  if (typeof patch.is_suspended === "boolean") {
    update.is_suspended = patch.is_suspended;
  }
  if (Object.keys(update).length === 0) {
    throw new Error("Nothing to update");
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select(
      "id, username, name, avatar_url, zaps, role, is_admin, is_suspended, created_at, updated_at, last_tracked_login",
    )
    .single();
  if (error) throw error;
  return rowToAdminUser(data as Record<string, unknown>, null);
}
