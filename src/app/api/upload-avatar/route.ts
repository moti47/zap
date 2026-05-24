import { NextResponse } from "next/server";
import { uploadAvatar } from "@/lib/db/storage";

/**
 * POST /api/upload-avatar — multipart form, field `file`.
 * Returns { url, mode }.
 *
 * Validates type + size (≤4MB). Falls back to a data URL when Supabase env
 * vars aren't set so the prototype demo still works without a backend.
 */
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large — max 4MB" },
        { status: 400 },
      );
    }
    if (file.type && !ALLOWED.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported image format" },
        { status: 400 },
      );
    }
    const haveEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!haveEnv) {
      const buf = Buffer.from(await file.arrayBuffer());
      const url = `data:${file.type || "image/png"};base64,${buf.toString(
        "base64",
      )}`;
      return NextResponse.json({ url, mode: "fallback" });
    }
    const { url } = await uploadAvatar(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
