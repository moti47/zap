import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Upload a single image to the post-images bucket.
 * The file is placed under {userId}/{timestamp}-{rand}.{ext} so RLS policies
 * (which require the first folder segment to match auth.uid()) pass.
 *
 * Returns the public URL on success.
 */
export async function uploadPostImage(file: File): Promise<{ url: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    (file.type.split("/")[1] ?? "png");
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${Date.now()}-${rand}.${ext}`;

  const { error } = await supabase.storage
    .from("post-images")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;

  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  return { url: data.publicUrl };
}
