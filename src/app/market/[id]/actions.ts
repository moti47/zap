"use server";

import { revalidatePath } from "next/cache";
import { resolveMarket } from "@/lib/db/market-resolution";
import { requireUser, NotSignedInError } from "@/lib/auth";
import { ResolveMarketInput, formatZodError } from "@/lib/validation";

export async function resolveMarketAction(input: unknown) {
  try {
    await requireUser();
    const parsed = ResolveMarketInput.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false as const,
        settledPositions: 0,
        totalPayout: 0,
        notified: 0,
        error: formatZodError(parsed.error),
      };
    }
    const v = parsed.data;
    const result = await resolveMarket(v.marketId, v.outcome);
    if (result.ok) {
      revalidatePath(`/market/${v.marketId}`);
      revalidatePath("/markets");
      revalidatePath("/notifications");
    }
    return result;
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
}
