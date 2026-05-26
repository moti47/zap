"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { adminCreateMarket, type AdminCreateMarketInput } from "@/lib/db/admin-markets";
import { approveProposal, rejectProposal } from "@/lib/db/proposals";

export async function adminCreateMarketAction(
  input: AdminCreateMarketInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const q = input.question.trim();
    if (q.length < 8) return { ok: false, error: "Question too short" };
    if (q.length > 280) return { ok: false, error: "Question too long" };
    if (!input.category_id) return { ok: false, error: "Pick a category" };
    if (new Date(input.resolution_date).getTime() < Date.now() + 60_000) {
      return { ok: false, error: "Resolution date must be in the future" };
    }
    if (input.resolution_source.trim().length < 4) {
      return { ok: false, error: "Resolution source required" };
    }
    const yes = Math.round(input.initial_yes_price);
    if (yes < 1 || yes > 99) {
      return { ok: false, error: "Initial YES price must be 1–99" };
    }
    const row = await adminCreateMarket({
      ...input,
      question: q,
      initial_yes_price: yes,
    });
    revalidatePath("/markets");
    revalidatePath("/");
    return { ok: true, id: row.id as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function approveProposalAction(
  proposalId: string,
): Promise<{ ok: true; marketId: string } | { ok: false; error: string }> {
  try {
    const market = await approveProposal(proposalId);
    revalidatePath("/admin/proposals");
    revalidatePath("/markets");
    return { ok: true, marketId: market.id as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function rejectProposalAction(
  proposalId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await rejectProposal(proposalId, reason);
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
