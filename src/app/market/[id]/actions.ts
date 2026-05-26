"use server";

import { revalidatePath } from "next/cache";
import { resolveMarket } from "@/lib/db/market-resolution";
import { requireUser, NotSignedInError } from "@/lib/auth";

export async function resolveMarketAction(input: {
  marketId: string;
  outcome: "yes" | "no";
}) {
  try {
    await requireUser();
    const result = await resolveMarket(input.marketId, input.outcome);
    if (result.ok) {
      revalidatePath(`/market/${input.marketId}`);
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
