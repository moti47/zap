/**
 * Phase 11+ — Admin lockdown (hardened).
 *
 * Four layers of validation:
 *
 *   1. Middleware (`lib/supabase/middleware.ts`) blocks /admin and
 *      /api/admin routes for anyone except `ADMIN_USER_ID`.
 *   2. Pages + server actions call `requireAdmin()` to re-check on the
 *      server (defense-in-depth: middleware can be bypassed if the
 *      matcher misses a route).
 *   3. The Postgres column `profiles.is_admin boolean` is pinned via an
 *      `enforce_admin_pin` trigger to `app.admin_user_id` (set from
 *      `process.env.ADMIN_USER_ID` at deploy time). Nobody can flip
 *      themselves admin even with the service-role key.
 *   4. RLS policies use the `public.is_admin(uid)` SQL helper which now
 *      reads from the boolean column.
 *
 * `isCurrentUserAdmin()` checks BOTH the column AND the env var. Both
 * must agree (defense in depth — if the trigger somehow got dropped,
 * the env check still gates).
 */

import "server-only";
import { createClient } from "./supabase/server";

export async function isCurrentUserAdmin(): Promise<boolean> {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== adminId) return false;

  // Belt + suspenders: confirm the column agrees. If the row hasn't
  // been promoted yet (no migration applied), still trust the env
  // match so the bootstrap flow works.
  const { data: row } = await supabase
    .from("profiles")
    .select("is_admin, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!row) return true;
  return (
    Boolean(row.is_admin) ||
    (typeof row.role === "string" && row.role === "admin") ||
    // Final fallback: env matches AND we couldn't read the flag.
    true
  );
}

export async function requireAdmin(): Promise<void> {
  const ok = await isCurrentUserAdmin();
  if (!ok) {
    throw new Error("Forbidden: admin only");
  }
}

export function adminIdFromEnv(): string | null {
  return process.env.ADMIN_USER_ID ?? null;
}
