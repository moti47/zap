import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { NotificationRow } from "@/lib/supabase/types";
import { NotSignedInError } from "@/lib/auth";

export type NotificationKind =
  | "follow"
  | "comment"
  | "reply"
  | "like"
  | "mention"
  | "trade"
  | "market_resolved"
  | "boost_ended"
  // Phase 11+ — market proposal verdicts
  | "market_proposal_approved"
  | "market_proposal_rejected";

export interface NotificationPayload {
  actor_id?: string;
  actor_name?: string;
  actor_username?: string;
  actor_avatar_url?: string | null;
  post_id?: string;
  comment_id?: string;
  market_id?: string;
  outcome?: "yes" | "no";
  trade_id?: string;
  title?: string;
  body?: string;
  href?: string;
  // Phase 11+ — proposal verdicts
  proposal_id?: string;
  reason?: string;
}

export type NotificationWithPayload = Omit<NotificationRow, "payload"> & {
  payload: NotificationPayload;
};

export async function listMyNotifications(
  limit = 50,
): Promise<NotificationWithPayload[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationWithPayload[];
}

export async function countMyUnread(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return count ?? 0;
}

export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new NotSignedInError();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  if (error) throw error;
}

export async function markOneRead(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new NotSignedInError();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

/**
 * Fan out notifications to a set of recipients. Skips the actor's own row
 * so users never notify themselves. Uses the service-role client so it
 * works from server actions without per-recipient session cookies.
 *
 * No-op (and logs a warning) when SUPABASE_SERVICE_ROLE_KEY isn't set
 * (prototype/no-backend mode).
 */
export async function fanoutNotifications(input: {
  recipientIds: string[];
  type: NotificationKind;
  payload: NotificationPayload;
  actorId?: string;
}) {
  if (!input.recipientIds.length) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const service = createServiceClient();
  const rows = Array.from(new Set(input.recipientIds))
    .filter((rid) => rid && rid !== input.actorId)
    .map((rid) => ({
      user_id: rid,
      type: input.type,
      payload: input.payload as unknown as Record<string, unknown>,
    }));
  if (!rows.length) return;
  const { error } = await service.from("notifications").insert(rows);
  if (error) throw error;
}
