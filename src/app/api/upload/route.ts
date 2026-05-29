import { NextResponse } from "next/server";
import { uploadPostImage } from "@/lib/db/storage";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { guardUpload, POST_IMAGE_GUARD } from "@/lib/upload-guard";
import { rateLimit, sweepIfStale } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/upload — multipart form, field `file`. Returns { url }.
 *
 * Auth-gated and size/MIME-validated. Storage RLS enforces folder
 * scoping (uploads must live under {auth.uid()}/…), but we fail fast
 * here so users get a clean error.
 *
 * Prototype fallback: if Supabase env vars aren't set, fall back to a
 * data URL so the demo composer still works locally.
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

    // 30 uploads / minute / user — way above any human pace, low
    // enough to stop a leaked token from racking up storage.
    const rl = rateLimit(`upload:${userId}`, { capacity: 10, refillPerSec: 0.5 });
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
    const guard = guardUpload(file, POST_IMAGE_GUARD);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    if (!haveEnv) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = `data:${file.type || "image/png"};base64,${buf.toString("base64")}`;
      return NextResponse.json({ url, mode: "fallback" });
    }
    const { url } = await uploadPostImage(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
