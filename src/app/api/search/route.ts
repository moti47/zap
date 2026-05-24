import { NextResponse } from "next/server";
import { searchAll } from "@/lib/db/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=foo — trigram-backed search across profiles, markets,
 * and post bodies. Returns { profiles, markets, posts } each capped at 8.
 *
 * Falls back to mock data when Supabase isn't wired so the prototype
 * still works offline.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({
      query: q,
      profiles: [],
      markets: [],
      posts: [],
    });
  }

  const haveEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!haveEnv) {
    const { mockSearch } = await import("@/lib/mock-search");
    return NextResponse.json(mockSearch(q));
  }
  try {
    const results = await searchAll(q);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
