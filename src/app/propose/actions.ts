"use server";

import { revalidatePath } from "next/cache";
import { submitProposal } from "@/lib/db/proposals";
import { requireUser, NotSignedInError } from "@/lib/auth";

export interface SubmitProposalInput {
  question: string;
  description: string;
  category_id: string;
  resolution_date: string; // ISO
  resolution_source: string;
  initial_yes_price: number;
  hero_image_url?: string | null;
}

export async function submitProposalAction(
  input: SubmitProposalInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireUser();
    const q = input.question.trim();
    if (q.length < 8) return { ok: false, error: "Question is too short" };
    if (q.length > 280) return { ok: false, error: "Question is too long" };
    if (!input.category_id) return { ok: false, error: "Pick a category" };
    if (!input.resolution_date) return { ok: false, error: "Resolution date required" };
    if (new Date(input.resolution_date).getTime() < Date.now() + 60_000) {
      return { ok: false, error: "Resolution date must be in the future" };
    }
    const src = input.resolution_source.trim();
    if (src.length < 4) return { ok: false, error: "Resolution source required" };
    const yes = Math.round(input.initial_yes_price);
    if (yes < 1 || yes > 99) {
      return { ok: false, error: "Initial YES price must be 1–99" };
    }

    const row = await submitProposal({
      question: q,
      description: input.description.trim().slice(0, 4000),
      category_id: input.category_id,
      resolution_date: input.resolution_date,
      resolution_source: src,
      initial_yes_price: yes,
      hero_image_url: input.hero_image_url ?? null,
    });
    revalidatePath("/propose");
    return { ok: true, id: row.id as string };
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return { ok: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
