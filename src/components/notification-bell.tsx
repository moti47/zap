"use client";

import { Bell, Check, MessageCircle, TrendingUp, Trophy, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { useZapStore } from "@/lib/store";
import { notifications } from "@/lib/mock-data";
import { timeAgo } from "@/lib/utils";

const iconMap = {
  trade: TrendingUp,
  follow: UserPlus,
  resolution: Trophy,
  comment: MessageCircle,
};

export function NotificationBell() {
  const unread = useZapStore((s) => s.unreadNotifications);
  const setOpen = useZapStore((s) => s.setNotificationsOpen);
  const markRead = useZapStore((s) => s.markNotificationsRead);

  return (
    <Popover
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTimeout(markRead, 300);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-[#FF4757] text-[9px] font-bold text-white flex items-center justify-center"
              >
                {unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-[#2A2F3D] flex items-center justify-between">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <button
            onClick={markRead}
            className="text-[11px] font-mono text-[#8B92A8] hover:text-white inline-flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.map((n) => {
            const Icon = iconMap[n.type];
            return (
              <div
                key={n.id}
                className="px-4 py-3 border-b border-[#2A2F3D] hover:bg-[#20232E]/40 cursor-pointer transition-colors flex gap-3"
              >
                <div className="h-8 w-8 rounded-full bg-[#20232E] border border-[#2A2F3D] flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-[#FFE600]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{n.title}</div>
                  <div className="text-xs text-[#8B92A8] mt-0.5">{n.body}</div>
                  <div className="text-[10px] font-mono text-[#5A6175] mt-1">
                    {timeAgo(n.timestamp)} ago
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[#2A2F3D]">
          <button className="text-[11px] font-mono text-[#8B92A8] hover:text-white">
            View all activity →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
