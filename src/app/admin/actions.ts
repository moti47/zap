"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { adminCreateMarket } from "@/lib/db/admin-markets";
import { approveProposal, rejectProposal } from "@/lib/db/proposals";
import {
  AdminCreateMarketInput,
  ApproveProposalInput,
  RejectProposalInput,
  formatZodError,
} from "@/lib/validation";

export async function adminCreateMarketAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = AdminCreateMarketInput.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: formatZodError(parsed.error) };
    }
    const row = await adminCreateMarket(parsed.data);
    revalidatePath("/markets");
    revalidatePath("/");
    return { ok: true, id: row.id as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function approveProposalAction(
  proposalId: unknown,
): Promise<{ ok: true; marketId: string } | { ok: false; error: string }> {
  try {
    // Defense-in-depth: enforce admin at the action boundary too.
    // `approveProposal` re-checks via the same helper.
    await requireAdmin();
    const parsed = ApproveProposalInput.safeParse({ proposalId });
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    const market = await approveProposal(parsed.data.proposalId);
    revalidatePath("/admin/proposals");
    revalidatePath("/markets");
    return { ok: true, marketId: market.id as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function rejectProposalAction(
  proposalId: unknown,
  reason: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = RejectProposalInput.safeParse({ proposalId, reason });
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    await rejectProposal(parsed.data.proposalId, parsed.data.reason);
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
