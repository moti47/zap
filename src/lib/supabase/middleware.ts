import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth-first middleware.
 *
 * Two tiers:
 *
 *   PUBLIC_READ — anonymous users can browse these. Writes inside
 *   them are gated by component-level `useRequireSignIn()` and by
 *   server-action `requireUser()` checks.
 *
 *   PROTECTED — must be signed in or you bounce to
 *   `/auth/sign-in?next=<pathname>`. These are personal surfaces
 *   (notifications, saved, drafts, edit profile, onboarding, quests,
 *   propose, admin).
 *
 * Plus PUBLIC_ASSETS for Next.js internals + PWA + auth routes.
 */

const PUBLIC_ASSET_PREFIXES = [
  "/_next",
  "/favicon",
  "/auth",
  "/api/auth",
];

const PUBLIC_ASSET_EXACT = new Set<string>([
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/sw.js",
]);

/**
 * Anonymous-browsable product surfaces.
 * Per the user's explicit spec: "Anonymous users should ONLY be able
 * to: browse public feed / browse public profiles / browse public
 * markets / browse leaderboard / sign in / sign up."
 *
 * `/` is the feed (read-only when anon). `/landing` is the marketing
 * page. `/category/[slug]` is read-only category browsing.
 */
const PUBLIC_READ_PREFIXES = [
  "/landing",
  "/markets",
  "/market/",
  "/leaderboard",
  "/profile/",      // viewing other users' profiles is public; /profile/edit is blocked below
  "/category/",
  "/catalog",
];

const PUBLIC_READ_EXACT = new Set<string>(["/", "/markets", "/leaderboard", "/catalog"]);

/**
 * Explicitly protected surfaces that LOOK public but aren't.
 * /profile/edit must be blocked even though /profile/<username> is
 * public. /api/upload* must be blocked because anonymous uploads have
 * no folder under storage RLS.
 */
const FORCE_PROTECTED_PREFIXES = [
  "/profile/edit",
  "/notifications",
  "/saved",
  "/drafts",
  "/quests",
  "/propose",
  "/admin",
  "/onboarding",
  "/api/upload",
  "/api/compose",
  "/api/trade",
];

function isPublicAsset(pathname: string): boolean {
  if (PUBLIC_ASSET_EXACT.has(pathname)) return true;
  return PUBLIC_ASSET_PREFIXES.some((p) => pathname.startsWith(p));
}

function isForcedProtected(pathname: string): boolean {
  return FORCE_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

function isPublicRead(pathname: string): boolean {
  if (PUBLIC_READ_EXACT.has(pathname)) return true;
  return PUBLIC_READ_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user: { id: string } | null = null;
  if (hasSupabaseEnv) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // IMPORTANT: refreshes expired tokens and writes new cookies via
    // setAll above. Don't remove this call.
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u ? { id: u.id } : null;
  }

  const pathname = request.nextUrl.pathname;
  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  // Tier 1: public assets — always allowed.
  if (isPublicAsset(pathname)) {
    return response;
  }

  // Tier 2: forced-protected — must be signed in regardless of read
  // status. /profile/edit beats /profile/* etc.
  if (hasSupabaseEnv && !user && isForcedProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Tier 3: admin lockdown. Even signed-in non-admins bounce.
  if (isAdminPath) {
    const adminId = process.env.ADMIN_USER_ID;
    if (!user || !adminId || user.id !== adminId) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("denied", "admin");
      return NextResponse.redirect(url);
    }
  }

  // Tier 4: public-read surfaces — anon browse is allowed.
  if (isPublicRead(pathname)) {
    return response;
  }

  // Tier 5: anything else — require auth.
  if (hasSupabaseEnv && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Auth-aware responses should never live in a shared cache.
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}
