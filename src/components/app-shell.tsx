"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";
import { PageTransition } from "./page-transition";
import { LiveFeedProvider } from "./live-feed-provider";
import { ViewerBoot } from "./viewer-boot";
import { useHydrateZapStore } from "@/lib/store";

interface AppShellProps {
  children: ReactNode;
  hideTopbar?: boolean;
}

export function AppShell({ children, hideTopbar = false }: AppShellProps) {
  const pathname = usePathname();
  const isLanding = pathname === "/landing" || pathname === "/onboarding";
  useHydrateZapStore();

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <LiveFeedProvider />
      <ViewerBoot />
      {!hideTopbar && <Topbar />}
      <main className="flex-1 min-w-0">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
