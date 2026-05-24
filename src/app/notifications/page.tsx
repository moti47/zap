"use client";

import { Bell, TrendingUp, Trophy, UserPlus, MessageCircle } from "lucide-react";
import { notifications } from "@/lib/mock-data";
import { ZapMark } from "@/components/zap-logo";
import { timeAgo } from "@/lib/utils";

const iconMap = {
  trade: TrendingUp,
  follow: UserPlus,
  resolution: Trophy,
  comment: MessageCircle,
};

export default function NotificationsPage() {
  return (
    <main className="max-w-[760px] mx-auto px-4 lg:px-6 py-6 w-full pb-24 lg:pb-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <button className="text-[11px] font-mono text-[#FFE600] hover:underline">
          Mark all read
        </button>
      </div>

      <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
        {notifications.map((n) => {
          const Icon = iconMap[n.type];
          return (
            <div
              key={n.id}
              className="flex gap-3 items-start px-5 py-4 border-b border-[#2A2F3D] hover:bg-[#20232E]/30 cursor-pointer transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-[#20232E] border border-[#2A2F3D] flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-[#FFE600]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-sm text-[#8B92A8] mt-0.5">{n.body}</div>
                <div className="text-[11px] font-mono text-[#5A6175] mt-1.5">
                  {timeAgo(n.timestamp)} ago
                </div>
              </div>
              {n.unread && (
                <span className="h-2 w-2 rounded-full bg-[#FFE600] mt-2" />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
