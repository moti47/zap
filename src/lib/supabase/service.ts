import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER ONLY. Bypasses RLS — never
 * import this from a client component or expose it to the browser.
 * Use for admin operations (seed scripts, market resolution, etc.).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createServiceClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
