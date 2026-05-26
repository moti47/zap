import { NextResponse } from "next/server";
import { uploadBanner } from "@/lib/db/storage";
import { requireUser, NotSignedInError } from "@/lib/auth";

/**
 * POST /api/upload-banner — multipart form, field `file`.
 * Returns { url, mode }.
 *
 * Validates type + size (≤6MB — banners are wider than avatars). Falls
 * back to a data URL when Supabase env isn't configured so the prototype
 * demo still persists in-session.
 */
export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

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
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large — max 6MB" },
        { status: 400 },
      );
    }
    if (file.type && !ALLOWED.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported image format" },
        { status: 400 },
      );
    }
    if (!haveEnv) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = `data:${file.type || "image/jpeg"};base64,${buf.toString(
        "base64",
      )}`;
      return NextResponse.json({ url, mode: "fallback" });
    }
    const { url } = await uploadBanner(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
