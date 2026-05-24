import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data ?? null;
}

export async function getProfileByUsername(
  username: string,
): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  return data ?? null;
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function updateMyProfile(patch: Partial<ProfileRow>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const safe: Partial<ProfileRow> = {
    name: patch.name,
    bio: patch.bio,
    avatar_url: patch.avatar_url,
    cover_gradient: patch.cover_gradient,
    onboarded: patch.onboarded,
    affinity: patch.affinity,
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(safe)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
