import { NextResponse } from "next/server";
import { uploadPostImage } from "@/lib/db/storage";

/**
 * POST /api/upload — multipart form, field `file`. Returns { url }.
 *
 * Prototype fallback: if Supabase env vars aren't set, fall back to a
 * data URL so the demo composer still works locally.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
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
    const { url } = await uploadPostImage(file);
    return NextResponse.json({ url, mode: "supabase" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
