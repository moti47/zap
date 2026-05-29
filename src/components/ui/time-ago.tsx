"use client";

import { useEffect, useState } from "react";
import { timeAgo as compute } from "@/lib/utils";

/**
 * Renders a relative timestamp ("22m", "3h") without the SSR/client
 * hydration mismatch that plain `{timeAgo(iso)}` causes. The server
 * renders the value computed at request time; the client renders the
 * exact same value during the first paint (no mismatch), then refreshes
 * itself on a 60-second cadence.
 *
 * `suppressHydrationWarning` covers the corner case where the request
 * crosses a second boundary mid-stream.
 */
export function TimeAgo({
  iso,
  className,
  prefix,
}: {
  iso: string;
  className?: string;
  prefix?: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
    // tick intentionally unused as a dep — interval owns its own state
  }, []);
  void tick;
  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      {compute(iso)}
    </span>
  );
}
