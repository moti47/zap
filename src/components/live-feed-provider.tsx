"use client";

import { useFakeSocket } from "@/lib/fake-socket";

export function LiveFeedProvider() {
  useFakeSocket();
  return null;
}
