import { NextResponse } from "next/server";
import { uploadAvatar } from "@/lib/db/storage";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { guardUpload, AVATAR_GUARD } from "@/lib/upload-guard";
import { rateLimit, sweepIfStale } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/upload-avatar — multipart form, field `file`.
 * Returns { url, mode }.
 *
 * Validates type + size (≤4MB). Falls back to a data URL when Supabase env
 * vars aren't set so the prototype demo still works without a backend.
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
    const rl = rateLimit(`upload-avatar:${userId}`, { capacity: 5, refillPerSec: 0.2 });
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
    const guard = guardUpload(file, AVATAR_GUARD);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    if (!haveEnv) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = `data:${file.type || "image/png"};base64,${buf.toString("base64")}`;
      return NextResponse.json({ url, mode: "fallback" });
    }
    const { url } = await uploadAvatar(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
