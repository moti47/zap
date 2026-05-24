import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DraftRow } from "@/lib/supabase/types";

export interface DraftWithCategory extends DraftRow {
  category: { slug: string; name: string; color: string } | null;
}

export async function listMyDrafts(limit = 20): Promise<DraftWithCategory[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("drafts")
    .select("*, category:categories(slug, name, color)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as DraftWithCategory[];
}

export async function saveDraft(input: {
  id?: string;
  body_html: string;
  category_id?: string | null;
  market_id?: string | null;
  images?: string[];
}): Promise<DraftRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const payload = {
    user_id: user.id,
    body_html: input.body_html,
    category_id: input.category_id ?? null,
    market_id: input.market_id ?? null,
    images: input.images ?? [],
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("drafts")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data as DraftRow;
  }

  const { data, error } = await supabase
    .from("drafts")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as DraftRow;
}

export async function deleteDraft(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("drafts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
