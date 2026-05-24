"use server";

import { createClient } from "@/lib/supabase/server";
import {
  fanoutNotifications,
  type NotificationPayload,
} from "@/lib/db/notifications";
import { getCurrentProfile } from "@/lib/db/profiles";

/**
 * Phase 9 — Fan out @mention notifications when a post is published.
 *
 * Resolves usernames → profile ids via Supabase, then inserts mention
 * notifications through the service-role client (skipping the actor's
 * own row). No-ops cleanly when Supabase isn't wired so the prototype
 * composer keeps working.
 */
export async function notifyMentionsAction(input: {
  usernames: string[];
  post_id: string;
  excerpt?: string;
}): Promise<{ ok: boolean; notified?: number; error?: string }> {
  try {
    const usernames = Array.from(
      new Set(
        (input.usernames || [])
          .map((u) => u.trim().toLowerCase())
          .filter((u) => /^[a-z0-9_]{2,30}$/i.test(u)),
      ),
    );
    if (usernames.length === 0) return { ok: true, notified: 0 };
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: true, notified: 0 };
    }

    const supabase = await createClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("username", usernames);

    if (!profiles?.length) return { ok: true, notified: 0 };

    const me = await getCurrentProfile();
    const payload: NotificationPayload = {
      actor_id: me?.id,
      actor_name: me?.name,
      actor_username: me?.username,
      actor_avatar_url: me?.avatar_url ?? null,
      post_id: input.post_id,
      body: input.excerpt?.slice(0, 200),
    };

    await fanoutNotifications({
      recipientIds: profiles.map((p) => p.id),
      type: "mention",
      payload,
      actorId: me?.id,
    });

    return { ok: true, notified: profiles.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
