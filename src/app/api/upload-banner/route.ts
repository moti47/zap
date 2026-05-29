import { NextResponse } from "next/server";
import { uploadBanner } from "@/lib/db/storage";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { guardUpload, BANNER_GUARD } from "@/lib/upload-guard";
import { rateLimit, sweepIfStale } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/upload-banner — multipart form, field `file`.
 * Returns { url, mode }.
 *
 * Validates type + size (≤6MB — banners are wider than avatars). Falls
 * back to a data URL when Supabase env isn't configured so the prototype
 * demo still persists in-session.
 */
export async function POST(req: Request) {
  sweepIfStale();
  try {
    const haveEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let userId = "anon";
    if (haveEnv) {
      try {
        const user = await requireUser();
        userId = user.id;
      } catch (err) {
        if (err instanceof NotSignedInError) {
          return NextResponse.json({ error: err.message }, { status: 401 });
        }
        throw err;
      }
    }
    const rl = rateLimit(`upload-banner:${userId}`, { capacity: 5, refillPerSec: 0.2 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many uploads — slow down" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const guard = guardUpload(file, BANNER_GUARD);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    if (!haveEnv) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
      return NextResponse.json({ url, mode: "fallback" });
    }
    const { url } = await uploadBanner(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
