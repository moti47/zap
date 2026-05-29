"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  Heart,
  MessageCircle,
  TrendingUp,
  Trophy,
  UserPlus,
  AtSign,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { useNotificationsChannel } from "@/lib/realtime";
import {
  markAllReadAction,
  markOneReadAction,
} from "@/app/notifications/actions";
import { cn } from "@/lib/utils";
import { TimeAgo } from "./ui/time-ago";
import type {
  NotificationWithPayload,
  NotificationKind,
} from "@/lib/db/notifications";

const ICONS: Record<string, typeof Bell> = {
  follow: UserPlus,
  comment: MessageCircle,
  reply: MessageCircle,
  like: Heart,
  mention: AtSign,
  trade: TrendingUp,
  market_resolved: Trophy,
  boost_ended: Rocket,
  // Phase 11+ — market proposal verdicts
  market_proposal_approved: Trophy,
  market_proposal_rejected: AtSign,
};

const COLORS: Record<string, string> = {
  follow: "#4DA3FF",
  comment: "#8B92A8",
  reply: "#8B92A8",
  like: "#FF4757",
  mention: "#FFE600",
  trade: "#00D982",
  market_resolved: "#FFB800",
  boost_ended: "#FF8A3D",
  market_proposal_approved: "#36D399",
  market_proposal_rejected: "#FF4757",
};

function hrefFor(n: NotificationWithPayload): string {
  const p = n.payload || {};
  if (p.href) return p.href;
  if (p.post_id) return `/feed#post-${p.post_id}`;
  if (p.market_id) return `/market/${p.market_id}`;
  if (n.type === "market_proposal_approved" || n.type === "market_proposal_rejected") {
    return "/propose";
  }
  if (p.actor_username) return `/profile/${p.actor_username}`;
  return "/notifications";
}

function titleFor(n: NotificationWithPayload): string {
  const p = n.payload || {};
  const actor = p.actor_name || p.actor_username || "Someone";
  switch (n.type as NotificationKind) {
    case "follow":
      return `${actor} followed you`;
    case "comment":
      return `${actor} commented on your post`;
    case "reply":
      return `${actor} replied to you`;
    case "like":
      return `${actor} liked your post`;
    case "mention":
      return `${actor} mentioned you`;
    case "trade":
      return `${actor} took a position`;
    case "market_resolved":
      return `Market resolved ${p.outcome?.toUpperCase() ?? ""}`;
    case "boost_ended":
      return `Your boost ended`;
    case "market_proposal_approved":
      return `Your market proposal was approved`;
    case "market_proposal_rejected":
      return `Your market proposal was rejected`;
    default:
      return p.title || "New activity";
  }
}

interface Props {
  initial: NotificationWithPayload[];
  userId: string | null;
  variant?: "page" | "popover";
}

export function NotificationsList({ initial, userId, variant = "page" }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  useNotificationsChannel(userId, ({ row }) => {
    setItems((prev) => [
      {
        ...(row as any),
        payload: ((row as any).payload ?? {}) as NotificationWithPayload["payload"],
      },
      ...prev,
    ]);
  });

  const unreadCount = useMemo(
    () => items.filter((i) => !i.read).length,
    [items],
  );

  const markAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    startTransition(async () => {
      const res = await markAllReadAction();
      if (!res.ok) toast.error(res.error || "Couldn't mark read");
    });
  };

  const markOne = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, read: true } : i)),
    );
    startTransition(() => {
      void markOneReadAction(id);
    });
  };

  if (variant === "popover") {
    return (
      <div className="w-full">
        <div className="px-4 py-3 border-b border-[#2A2F3D] flex items-center justify-between">
          <h4 className="text-sm font-semibold">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-[10px] font-mono text-[#FFE600]">
                {unreadCount} new
              </span>
            )}
          </h4>
          <button
            onClick={markAll}
            disabled={unreadCount === 0}
            className="text-[11px] font-mono text-[#8B92A8] hover:text-white inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-default"
          >
            <Check className="h-3 w-3" /> Mark all
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <Empty compact />
          ) : (
            <AnimatePresence initial={false}>
              {items.slice(0, 12).map((n) => (
                <Row
                  key={n.id}
                  n={n}
                  compact
                  onClick={() => {
                    markOne(n.id);
                    router.push(hrefFor(n));
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
        <div className="px-4 py-2 border-t border-[#2A2F3D]">
          <Link
            href="/notifications"
            className="text-[11px] font-mono text-[#8B92A8] hover:text-white"
          >
            View all activity →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-[760px] mx-auto px-4 lg:px-6 py-6 w-full pb-24 lg:pb-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <button
          onClick={markAll}
          disabled={unreadCount === 0}
          className="text-[11px] font-mono text-[#FFE600] hover:underline disabled:opacity-40 disabled:cursor-default disabled:no-underline"
        >
          Mark all read
        </button>
      </div>

      {items.length === 0 ? (
        <Empty />
      ) : (
        <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((n) => (
              <Row
                key={n.id}
                n={n}
                onClick={() => {
                  markOne(n.id);
                  router.push(hrefFor(n));
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}

function Row({
  n,
  onClick,
  compact = false,
}: {
  n: NotificationWithPayload;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = ICONS[n.type] ?? Bell;
  const color = COLORS[n.type] ?? "#8B92A8";
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex gap-3 items-start px-4 border-b border-[#2A2F3D] hover:bg-[#20232E]/40 transition-colors",
        compact ? "py-3" : "py-4 px-5",
        !n.read && "bg-[#FFE600]/[0.025]",
      )}
    >
      <div
        className="h-9 w-9 rounded-full bg-[#20232E] border border-[#2A2F3D] flex items-center justify-center flex-shrink-0"
        style={{ borderColor: `${color}40` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight truncate">
          {titleFor(n)}
        </div>
        {n.payload?.body && (
          <div className="text-xs text-[#8B92A8] mt-0.5 line-clamp-2">
            {n.payload.body}
          </div>
        )}
        <div className="text-[10px] font-mono text-[#5A6175] mt-1">
          <TimeAgo iso={n.created_at} /> ago
        </div>
      </div>
      {!n.read && (
        <span
          className="h-2 w-2 rounded-full mt-2 flex-shrink-0"
          style={{ background: "#FFE600" }}
          aria-label="Unread"
        />
      )}
    </motion.button>
  );
}

function Empty({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "text-center text-[#8B92A8]",
        compact ? "p-6 text-sm" : "rounded-[14px] border border-dashed border-[#2A2F3D] bg-[#14161D]/40 p-10",
      )}
    >
      <Bell className="h-6 w-6 mx-auto text-[#5A6175]" />
      <div className="mt-2 font-medium">No notifications yet</div>
      {!compact && (
        <p className="text-xs mt-1 text-[#5A6175]">
          Likes, replies, follows, mentions, and market resolutions will appear
          here.
        </p>
      )}
    </div>
  );
}
