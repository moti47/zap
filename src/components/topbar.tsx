"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Menu,
  User as UserIcon,
  Pencil,
  LogOut,
  Wallet,
  X,
} from "lucide-react";
import { useViewer } from "@/lib/use-viewer";
import { UserAvatar } from "./user-avatar";
import { ZapLogo } from "./zap-logo";
import { BalancePill } from "./balance-pill";
import { NotificationBell } from "./notification-bell";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown";
import { GlobalSearch } from "./global-search";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  match: (p: string) => boolean;
  adminOnly?: boolean;
  /** Round-2 — items that require a signed-in user. Hidden when
   *  `viewer` is null so anon visitors don't see Quests / Saved /
   *  Portfolio (middleware would bounce them anyway, but the nav
   *  shouldn't tease an account-only surface). */
  authOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/", label: "Feed", match: (p: string) => p === "/" },
  {
    href: "/markets",
    label: "Markets",
    match: (p: string) => p === "/markets" || p.startsWith("/market"),
  },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/saved", label: "Saved", match: (p: string) => p.startsWith("/saved"), authOnly: true },
  { href: "/quests", label: "Quests", match: (p: string) => p.startsWith("/quests"), authOnly: true },
  { href: "/portfolio", label: "Portfolio", match: (p: string) => p.startsWith("/portfolio"), authOnly: true },
  // Signed-in users can propose markets; admins approve them. The
  // entry point used to be hidden, which made "create market" feel
  // broken — now there's a clear nav-level affordance.
  { href: "/propose", label: "Propose", match: (p: string) => p.startsWith("/propose"), authOnly: true },
  { href: "/admin", label: "Admin", match: (p: string) => p.startsWith("/admin"), adminOnly: true },
];

export function Topbar() {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Balance now lives inside <BalancePill /> — it reads viewer.zaps
  // directly from useViewer (which is realtime-synced to Supabase
  // postgres_changes on the profiles row).
  const displayName = viewer?.name ?? "You";
  const displayUsername = viewer?.username ?? "you";
  const displayInitial = (displayName || "Y").charAt(0).toUpperCase();

  // Cmd/Ctrl-K toggles the global search dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0A0B0F]/85 backdrop-blur-md border-b border-[#2A2F3D]">
        <div className="flex items-center gap-3 lg:gap-6 px-4 lg:px-6 h-14 max-w-[1400px] mx-auto">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden text-[#8B92A8] hover:text-white p-1 -ml-1"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <ZapLogo size="md" />
          </Link>

          {/* Center nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navItems
              .filter((item) => (!item.adminOnly || viewer?.is_admin) && (!item.authOnly || !!viewer))
              .map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "text-white"
                      : "text-[#8B92A8] hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="topbar-active"
                      className="absolute inset-0 bg-[#20232E] border border-[#2A2F3D] rounded-md"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer for mobile */}
          <div className="flex-1 md:hidden" />

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            {/* Anonymous branch — no fake profile chip, no Zaps pill,
                no compose. Just two clear CTAs. */}
            {!viewer && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  className="hidden sm:inline-flex"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Link
                  href={`/auth/sign-in?next=${encodeURIComponent(pathname || "/")}`}
                  className="inline-flex items-center h-8 px-3 rounded-md text-[12.5px] font-semibold text-white hover:bg-[#20232E] transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href={`/auth/sign-up?next=${encodeURIComponent(pathname || "/")}`}
                  className="inline-flex items-center h-8 px-3 rounded-md text-[12.5px] font-bold bg-[#FFE600] text-[#0E1016] hover:scale-[1.03] active:scale-95 transition-transform"
                >
                  Create account
                </Link>
              </>
            )}

            {/* Signed-in branch — everything below. */}
            {viewer && (
            <>
            {/* Realtime-synced Zaps balance pill (desktop only). */}
            <BalancePill variant="default" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            <NotificationBell />

            {/* Item #3 — Compose no longer opens a modal. It smooth-
                scrolls to the top of the feed (where the in-feed
                composer lives) and dispatches `zap:focus-composer` so
                the editor takes focus. If the viewer isn't on a route
                that mounts the composer (e.g. /portfolio), we route
                them to "/" first; the composer's mount effect picks up
                the event on the next tick. */}
            <Button
              size="sm"
              variant="default"
              className="hidden sm:inline-flex"
              onClick={() => {
                if (pathname !== "/") {
                  window.location.href = "/#compose";
                  return;
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("zap:focus-composer"));
              }}
            >
              <Plus className="h-4 w-4" /> Compose
            </Button>

            {/* Mobile compose icon — same scroll-to-top behavior. */}
            <Button
              variant="default"
              size="icon"
              className="sm:hidden"
              onClick={() => {
                if (pathname !== "/") {
                  window.location.href = "/#compose";
                  return;
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("zap:focus-composer"));
              }}
              aria-label="Compose"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#FFE600] focus:ring-offset-2 focus:ring-offset-[#0A0B0F]"
                  aria-label="Profile menu"
                >
                  {viewer?.avatar_url ? (
                    <UserAvatar
                      src={viewer.avatar_url}
                      name={displayName}
                      size="sm"
                      showScore={false}
                      cacheKey={viewer.updated_at}
                      priority
                    />
                  ) : (
                    <span className="block h-8 w-8 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] grid place-items-center text-[#0A0B0F] font-bold text-sm">
                      {displayInitial}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold text-sm">
                      {displayName}
                    </span>
                    <span className="text-[11px] font-mono text-[#5A6175]">
                      @{displayUsername}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile/you" className="cursor-pointer">
                    <UserIcon className="h-4 w-4 mr-2 text-[#8B92A8]" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/edit" className="cursor-pointer">
                    <Pencil className="h-4 w-4 mr-2 text-[#8B92A8]" />
                    Edit Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portfolio" className="cursor-pointer">
                    <Wallet className="h-4 w-4 mr-2 text-[#8B92A8]" />
                    My Portfolio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  // Hard-navigate to the sign-out route. The route now
                  // accepts GET, clears every sb-* cookie, and 303s back
                  // to /auth/sign-in. No nested form/button, no
                  // hydration warnings, no ghost sessions.
                  onSelect={(e) => {
                    e.preventDefault();
                    window.location.href = "/auth/sign-out";
                  }}
                  className="cursor-pointer text-[#FF4757] focus:text-[#FF4757]"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
            )}
          </div>
        </div>
      </header>

      {/* Global search modal (Phase 9) */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
        >
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 w-72 bg-[#0E1016] border-r border-[#2A2F3D] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2A2F3D]">
              <ZapLogo size="md" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#8B92A8] hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-0.5">
              {navItems
              .filter((item) => (!item.adminOnly || viewer?.is_admin) && (!item.authOnly || !!viewer))
              .map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2.5 rounded-md text-[15px] font-medium transition-colors",
                      active
                        ? "text-white bg-[#20232E] border border-[#2A2F3D]"
                        : "text-[#8B92A8] hover:text-white hover:bg-[#20232E]/40"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t border-[#2A2F3D] my-3" />
              {viewer ? (
                <>
                  <Link
                    href="/profile/you"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2.5 rounded-md text-[15px] font-medium text-[#8B92A8] hover:text-white hover:bg-[#20232E]/40"
                  >
                    <UserIcon className="h-4 w-4 mr-3" /> My Profile
                  </Link>
                  <Link
                    href="/notifications"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2.5 rounded-md text-[15px] font-medium text-[#8B92A8] hover:text-white hover:bg-[#20232E]/40"
                  >
                    Notifications
                  </Link>
                </>
              ) : (
                <div className="px-1 space-y-2">
                  <Link
                    href={`/auth/sign-up?next=${encodeURIComponent(pathname || "/")}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2.5 rounded-md text-[14px] font-bold bg-[#FFE600] text-[#0E1016]"
                  >
                    Create account
                  </Link>
                  <Link
                    href={`/auth/sign-in?next=${encodeURIComponent(pathname || "/")}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2.5 rounded-md text-[14px] font-semibold text-white border border-[#2A2F3D]"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </nav>
            {viewer && (
              <div className="p-4 border-t border-[#2A2F3D]">
                <BalancePill variant="stacked" />
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </>
  );
}
