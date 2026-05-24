"use server";

import { revalidatePath } from "next/cache";
import { markAllRead, markOneRead } from "@/lib/db/notifications";

export async function markAllReadAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await markAllRead();
    revalidatePath("/notifications");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markOneReadAction(id: string) {
  try {
    await markOneRead(id);
    revalidatePath("/notifications");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
