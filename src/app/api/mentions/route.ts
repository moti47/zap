import { NextResponse } from "next/server";
import { searchProfilesByPrefix } from "@/lib/db/search";
import { users as mockUsers } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

/**
 * GET /api/mentions?q=al — prefix lookup of usernames + names for the
 * composer's @-mention popover. Returns up to 6 matches.
 *
 * Falls back to demo fixtures when Supabase isn't wired so the demo composer
 * still gets useful suggestions.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ users: [] });

  const haveEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (haveEnv) {
    try {
      const users = await searchProfilesByPrefix(q, 6);
      return NextResponse.json({ users });
    } catch {
      // fall through to mocks
    }
  }
  const needle = q.toLowerCase();
  const users = mockUsers
    .filter(
      (u) =>
        u.username.toLowerCase().startsWith(needle) ||
        u.name.toLowerCase().startsWith(needle),
    )
    .slice(0, 6)
    .map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatar_url: u.avatarUrl,
    }));
  return NextResponse.json({ users });
}
