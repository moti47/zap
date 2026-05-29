"use server";

import { revalidatePath } from "next/cache";
import { submitProposal } from "@/lib/db/proposals";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { SubmitProposalInput, formatZodError } from "@/lib/validation";

export async function submitProposalAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireUser();
    const parsed = SubmitProposalInput.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: formatZodError(parsed.error) };
    }
    const v = parsed.data;
    const row = await submitProposal({
      question: v.question,
      description: v.description,
      category_id: v.category_id,
      resolution_date: v.resolution_date,
      resolution_source: v.resolution_source,
      initial_yes_price: v.initial_yes_price,
      hero_image_url: v.hero_image_url ?? null,
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
