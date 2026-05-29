/**
 * Single source of truth for "is this a demo / preview environment, or
 * a real production deployment?".
 *
 * Real production = Supabase env vars are set AND the explicit demo
 * flag is NOT enabled. In that mode, fixture data MUST NOT leak into
 * any rendered surface — users see only real data persisted to
 * Supabase, even if it means empty states.
 *
 * Demo mode = either env is missing (prototype `npm run dev` with no
 * backend) or `NEXT_PUBLIC_ENABLE_DEMO=1` is set (designer wants to
 * walk through screens with seeded content).
 *
 * Both server and client read the public env so SSR and CSR agree on
 * the gate and we never hydrate-mismatch on it.
 */
export function isDemoMode(): boolean {
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!hasEnv) return true;
  return process.env.NEXT_PUBLIC_ENABLE_DEMO === "1";
}
