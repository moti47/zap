"use client";

import { createBrowserClient } from "@supabase/ssr";

// NOTE: once you've connected the project, run
//   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
// and add the Database generic to all three createClient helpers.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
