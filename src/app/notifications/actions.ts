"use server";

import { revalidatePath } from "next/cache";
import { markAllRead, markOneRead } from "@/lib/db/notifications";
import { requireUser, NotSignedInError } from "@/lib/auth";

export async function markAllReadAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireUser();
    await markAllRead();
    revalidatePath("/notifications");
    return { ok: true };
  } catch (err) {
    if (err instanceof NotSignedInError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markOneReadAction(id: string) {
  try {
    await requireUser();
    await markOneRead(id);
    revalidatePath("/notifications");
    return { ok: true };
  } catch (err) {
    if (err instanceof NotSignedInError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
