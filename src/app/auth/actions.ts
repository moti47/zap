"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  SignInInput,
  SignUpInput,
  MagicLinkInput,
  formatZodError,
} from "@/lib/validation";

/**
 * Guard for the demo-mode (no Supabase env) build. Every auth action
 * MUST short-circuit before touching `createClient()` — otherwise the
 * server crashes into the global error boundary the moment a user
 * submits the form.
 */
function hasSupabaseEnv(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const NO_ENV_ERROR =
  "Sign-in isn't configured for this preview. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts.";

/**
 * Auth server actions.
 *
 * - `signInWithPassword` / `signInWithMagicLink` — login flows.
 * - `signUpWithPassword` — creates the auth user + writes the
 *   `name + username` claims into auth metadata so the `handle_new_user`
 *   trigger (in 0001_init.sql) can persist them onto the
 *   `profiles` row. We also pre-check that the username isn't taken so
 *   we can surface a clear error instead of a Supabase 23505.
 * - `signOut` — server-action variant. The route handler at
 *   `/auth/sign-out` is the primary path because it can write cookie
 *   deletions onto a redirect response directly; this action exists for
 *   places that need to fire-and-forget from a transition.
 *
 * Every successful auth state change calls `revalidatePath('/', 'layout')`
 * so the topbar + every Server Component reading `auth.getUser()` flips
 * to the new state without a manual reload.
 */

export async function signInWithPassword(
  email: unknown,
  password: unknown,
  next: unknown,
): Promise<{ ok: true; next: string } | { error: string }> {
  if (!hasSupabaseEnv()) return { error: NO_ENV_ERROR };
  const parsed = SignInInput.safeParse({ email, password, next });
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: v.email,
    password: v.password,
  });
  if (error) return { error: error.message };
  // Return next URL — the client navigates inside the same React
  // transition so the form's `pending` state stays true through the
  // navigation. Server-side `redirect()` returns control too early
  // and makes the spinner disappear before the target page paints.
  return { ok: true, next: v.next || "/" };
}

export async function signInWithMagicLink(email: unknown) {
  if (!hasSupabaseEnv()) return { error: NO_ENV_ERROR };
  const parsed = MagicLinkInput.safeParse({ email });
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  const supabase = await createClient();
  const h = await headers();
  const origin =
    h.get("origin") ?? `https://${h.get("host") ?? "localhost:3000"}`;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signUpWithPassword(
  input: unknown,
): Promise<{ ok: true; next: string } | { error: string }> {
  if (!hasSupabaseEnv()) return { error: NO_ENV_ERROR };
  const parsed = SignUpInput.safeParse(input);
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  const v = parsed.data;

  // Pre-flight username uniqueness check via the service-role client
  // (the username column has a UNIQUE index, but checking here lets us
  // surface a clean error before the auth user gets created).
  try {
    const svc = createServiceClient();
    const { data: existing } = await svc
      .from("profiles")
      .select("id")
      .eq("username", v.username)
      .maybeSingle();
    if (existing) {
      return { error: "That username is already taken" };
    }
  } catch {
    // Service role not configured — fall through; the unique constraint
    // will still catch collisions and we'll surface the Supabase error.
  }

  const supabase = await createClient();
  const h = await headers();
  const origin =
    h.get("origin") ?? `https://${h.get("host") ?? "localhost:3000"}`;

  const { error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      data: { name: v.name, username: v.username },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(v.next)}`,
    },
  });
  if (error) {
    // Surface unique-violation as a friendly message.
    if (/already registered/i.test(error.message)) {
      return { error: "An account with that email already exists" };
    }
    return { error: error.message };
  }
  // Client-side navigation inside the same transition — see
  // signInWithPassword note above.
  return { ok: true, next: v.next || "/onboarding" };
}

export async function signOut() {
  if (!hasSupabaseEnv()) {
    // Nothing to sign out from — just bounce to the page.
    redirect("/auth/sign-in");
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect("/auth/sign-in");
}
