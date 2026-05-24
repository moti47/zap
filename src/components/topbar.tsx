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
  Settings,
  X,
} from "lucide-react";
import { useZapStore, useHydrated } from "@/lib/store";
import { ZapLogo, ZapMark } from "./zap-logo";
import { NotificationBell } from "./notification-bell";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown";
import { PostComposer } from "./post/post-composer";
import { GlobalSearch } from "./global-search";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Feed", match: (p: string) => p === "/" },
  {
    href: "/markets",
    label: "Markets",
    match: (p: string) => p === "/markets" || p.startsWith("/market"),
  },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/saved", label: "Saved", match: (p: string) => p.startsWith("/saved") },
];

export function Topbar() {
  const points = useZapStore((s) => s.points);
  const hydrated = useHydrated();
  const pathname = usePathname();
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            {navItems.map((item) => {
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
            {/* Balance pill — md+ */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#2A2F3D] bg-[#14161D]">
              <span className="text-[10px] uppercase tracking-widest text-[#5A6175] font-mono">
                Balance
              </span>
              <span className="text-sm font-bold num">
                {hydrated ? points.toLocaleString() : "1,000"}
              </span>
              <ZapMark />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            <NotificationBell />

            <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  className="hidden sm:inline-flex"
                >
                  <Plus className="h-4 w-4" /> Compose
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl p-0">
                <DialogHeader className="p-5 pb-0">
                  <DialogTitle>Write a post</DialogTitle>
                  <DialogDescription className="sr-only">
                    Compose a new post with text, image, category, and optional market.
                  </DialogDescription>
                </DialogHeader>
                <div className="p-5 pt-3">
                  <PostComposer
                    onPublish={() => setComposerOpen(false)}
                    autoFocus
                    variant="modal"
                  />
                </div>
              </DialogContent>
            </Dialog>

            {/* Mobile compose icon */}
            <Button
              variant="default"
              size="icon"
              className="sm:hidden"
              onClick={() => setComposerOpen(true)}
              aria-label="Compose"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#FFE600] focus:ring-offset-2 focus:ring-offset-[#0A0B0F]"
                  aria-label="Profile menu"
                >
                  Y
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold text-sm">You</span>
                    <span className="text-[11px] font-mono text-[#5A6175]">@you</span>
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
                  <Link href="/onboarding" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2 text-[#8B92A8]" />
                    Preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action="/auth/sign-out" method="post" className="w-full">
                    <button
                      type="submit"
                      className="flex items-center w-full text-left text-[#FF4757]"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              {navItems.map((item) => {
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
            </nav>
            <div className="p-4 border-t border-[#2A2F3D]">
              <div className="rounded-md border border-[#FFB800]/20 bg-gradient-to-br from-[#1F1A0E] to-[#1A1D26] p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#8B92A8] font-mono">
                  Your Balance
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold tracking-tight num text-white">
                    {hydrated ? points.toLocaleString() : "1,000"}
                  </span>
                  <ZapMark />
                </div>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </>
  );
}
