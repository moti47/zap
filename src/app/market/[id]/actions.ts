"use server";

import { revalidatePath } from "next/cache";
import { resolveMarket } from "@/lib/db/market-resolution";

export async function resolveMarketAction(input: {
  marketId: string;
  outcome: "yes" | "no";
}) {
  const result = await resolveMarket(input.marketId, input.outcome);
  if (result.ok) {
    revalidatePath(`/market/${input.marketId}`);
    revalidatePath("/markets");
    revalidatePath("/notifications");
  }
  return result;
}
