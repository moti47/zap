"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function signInWithPassword(
  email: string,
  password: string,
  next: string,
) {
  if (!hasSupabaseEnv()) return { error: NO_ENV_ERROR };
  if (!email || !password) {
    return { error: "Email and password are required" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(next || "/feed");
}

export async function signInWithMagicLink(email: string) {
  if (!hasSupabaseEnv()) return { error: NO_ENV_ERROR };
  if (!email) return { error: "Email is required" };
  const supabase = await createClient();
  const h = await headers();
  const origin =
    h.get("origin") ?? `https://${h.get("host") ?? "localhost:3000"}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  name: string;
  username: string;
  next: string;
}) {
  if (!hasSupabaseEnv()) return { error: NO_ENV_ERROR };
  const username = (input.username || "").trim().toLowerCase();
  const name = (input.name || "").trim();
  const email = (input.email || "").trim();

  if (!name) return { error: "Display name is required" };
  if (!USERNAME_RE.test(username)) {
    return {
      error: "Username must be 3–20 chars: lowercase letters, numbers, or _",
    };
  }
  if (!email) return { error: "Email is required" };
  if (!input.password || input.password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  // Pre-flight username uniqueness check via the service-role client
  // (the username column has a UNIQUE index, but checking here lets us
  // surface a clean error before the auth user gets created).
  try {
    const svc = createServiceClient();
    const { data: existing } = await svc
      .from("profiles")
      .select("id")
      .eq("username", username)
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
    email,
    password: input.password,
    options: {
      data: { name, username },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(input.next)}`,
    },
  });
  if (error) {
    // Surface unique-violation as a friendly message.
    if (/already registered/i.test(error.message)) {
      return { error: "An account with that email already exists" };
    }
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  redirect(input.next || "/onboarding");
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
