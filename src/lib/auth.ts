import "server-only";
import { createClient } from "./supabase/server";

/**
 * Server-side auth chokepoint.
 *
 * Every server action that mutates persistent state — posts, comments,
 * likes, bookmarks, follows, trades, quest claims, market proposals,
 * admin actions — MUST start with `await requireUser()`. This is the
 * single defensible boundary between anonymous browsing and writes.
 *
 * Returns the authenticated Supabase user (id + email + metadata).
 * Throws a structured error that the action wrapper surfaces to the
 * client as a "Please sign in" message.
 *
 * `getOptionalUser()` is the non-throwing variant for read paths that
 * adapt their output to the viewer when present.
 */

export class NotSignedInError extends Error {
  readonly code = "NOT_SIGNED_IN";
  constructor() {
    super("You must be signed in to do that");
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new NotSignedInError();
  return user;
}

export async function getOptionalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
