"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useViewer } from "./use-viewer";

/**
 * Client-side auth gate for interaction buttons.
 *
 * Usage:
 *   const gate = useRequireSignIn();
 *   const onLike = gate(() => toggleLike(post.id));
 *
 * When the viewer is signed in → runs `fn`.
 * When the viewer is anonymous → toasts a friendly nudge AND redirects
 *   to `/auth/sign-in?next=<current-pathname>` so the user lands back
 *   where they were after signing in.
 *
 * Anonymous users see all the buttons (so the UI feels normal), but
 * the moment they click ANY mutate action we redirect. Server actions
 * still re-check via `requireUser()` — UI gating is a UX nicety, not a
 * security boundary.
 */
export function useRequireSignIn() {
  const router = useRouter();
  const { viewer, loading } = useViewer();
  return function gate<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    options: { message?: string } = {},
  ) {
    return (...args: TArgs): TReturn | undefined => {
      if (loading) return undefined; // ignore clicks while we resolve
      if (!viewer) {
        const next =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/";
        toast.info(
          options.message ?? "Sign in to continue",
          { description: "Free — takes 20 seconds." },
        );
        router.push(`/auth/sign-in?next=${encodeURIComponent(next)}`);
        return undefined;
      }
      return fn(...args);
    };
  };
}

/**
 * Convenience hook for places that just need to *know* if the viewer
 * is signed in without wiring the gate. Returns `{ isSignedIn, viewer,
 * loading }`. Keep this dumb — no side effects.
 */
export function useIsSignedIn() {
  const { viewer, loading } = useViewer();
  return { isSignedIn: !!viewer, viewer, loading };
}
