import { NextResponse } from "next/server";
import { uploadPostImage } from "@/lib/db/storage";
import { requireUser, NotSignedInError } from "@/lib/auth";

/**
 * POST /api/upload — multipart form, field `file`. Returns { url }.
 *
 * Auth-gated: anonymous requests are rejected with 401. Storage RLS
 * also enforces this, but failing fast here gives a cleaner error.
 *
 * Prototype fallback: if Supabase env vars aren't set, fall back to a
 * data URL so the demo composer still works locally.
 */
export async function POST(req: Request) {
  try {
    const haveEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (haveEnv) {
      try {
        await requireUser();
      } catch (err) {
        if (err instanceof NotSignedInError) {
          return NextResponse.json({ error: err.message }, { status: 401 });
        }
        throw err;
      }
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!haveEnv) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = `data:${file.type || "image/png"};base64,${buf.toString(
        "base64",
      )}`;
      return NextResponse.json({ url, mode: "fallback" });
    }
    const { url } = await uploadPostImage(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
