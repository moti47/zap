import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";

/**
 * Production-hardened sign-out.
 *
 * Root cause of the previous ghost-session bug: even though
 * `supabase.auth.signOut()` writes Set-Cookie deletions through the
 * SSR helper's `setAll` callback, we were ALSO not:
 *   - clearing every cookie variant Supabase SSR writes
 *     (`sb-<ref>-auth-token`, chunked `.0` / `.1`, `-code-verifier`,
 *      `-refresh-token`, legacy `sb-access-token` / `sb-refresh-token`)
 *   - emitting `Cache-Control: no-store` on the redirect so the
 *     browser's back-cache couldn't serve a signed-in HTML snapshot
 *   - broadcasting the SIGNED_OUT event to other tabs (handled by
 *     `useViewer()` now subscribing to `onAuthStateChange`)
 *
 * This route now:
 *   1. Builds the redirect response FIRST so cookies write onto it
 *      directly.
 *   2. Calls `supabase.auth.signOut({ scope: 'global' })` — invalidates
 *      every refresh token server-side, even on other devices.
 *   3. Iterates every cookie on the request, deleting anything that
 *      looks like Supabase auth state. We force `path=/` and
 *      `maxAge=0` AND an explicit past `expires` date because some
 *      browsers ignore `maxAge` for cookies without an `expires`.
 *   4. Adds aggressive no-store headers so the back button can't show
 *      a cached signed-in HTML snapshot.
 *   5. Calls `revalidatePath('/', 'layout')` so every RSC re-renders
 *      against the signed-out session.
 */
async function handle(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/sign-in";
  url.search = "";
  const response = NextResponse.redirect(url, { status: 303 });

  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1) Belt-and-suspenders cookie wipe — runs even if signOut() throws.
  const past = new Date(0);
  const clearCookie = (name: string) => {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: past,
      sameSite: "lax",
    });
  };
  const isAuthCookie = (name: string) =>
    name.startsWith("sb-") ||
    name.startsWith("supabase-") ||
    name === "sb-access-token" ||
    name === "sb-refresh-token";

  for (const cookie of request.cookies.getAll()) {
    if (isAuthCookie(cookie.name)) {
      clearCookie(cookie.name);
    }
  }

  // 2) Server-side global sign-out — invalidates refresh tokens
  // everywhere. We still wrap in try so a network blip doesn't block
  // the local cookie wipe above.
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Merge with the explicit wipe — Supabase asks us to set
          // empty/expired auth cookies; we also need to honor any
          // additional values they emit.
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Swallow — local cookie wipe + revalidatePath still complete.
    }
  }

  // 3) RSC cache flush — topbar + every Server Component reading
  // `auth.getUser()` re-renders against the signed-out session.
  revalidatePath("/", "layout");

  return response;
}

export const POST = handle;
export const GET = handle;
