"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { NotificationsList } from "./notifications-list";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { useNotificationsChannel } from "@/lib/realtime";
import type { NotificationWithPayload } from "@/lib/db/notifications";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationWithPayload[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Skip Supabase wiring entirely in prototype/no-backend mode so the
    // popover doesn't blow up the page.
    if (!hasSupabaseEnv()) {
      setLoaded(true);
      return;
    }
    const sb = createClient();
    (async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setLoaded(true);
        return;
      }
      const { data: rows } = await sb
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(25);
      if (cancelled) return;
      setItems((rows ?? []) as NotificationWithPayload[]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useNotificationsChannel(userId, ({ row }) => {
    setItems((prev) => [row as NotificationWithPayload, ...prev]);
  });

  const unread = items.filter((i) => !i.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0
              ? `Notifications (${unread} unread)`
              : "Notifications"
          }
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-[#FF4757] text-[9px] font-bold text-white flex items-center justify-center"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {!loaded ? (
          <div className="p-6 text-center text-sm text-[#5A6175]">Loading…</div>
        ) : (
          <NotificationsList
            initial={items}
            userId={userId}
            variant="popover"
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
