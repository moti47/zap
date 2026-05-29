"use client";

import { useState } from "react";
import Image from "next/image";
import { Bell, Check, Calendar, Share2, MoreHorizontal, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { EditProfileModal } from "./edit-profile-modal";
import { UserAvatar } from "../user-avatar";
import { ExpertBadge } from "../expert-badge";
import { Button } from "../ui/button";
import { ZapMark } from "../zap-logo";
import { useZapStore } from "@/lib/store";
import { fireBumpQuest } from "@/lib/quest-bump";
import { useShallow } from "zustand/react/shallow";
import { formatLargeNumber, categoryColor } from "@/lib/utils";
import type { User } from "@/lib/fixtures";
import type { ProfileRow } from "@/lib/supabase/types";

interface ProfileHeroProps {
  user: User;
  /** Supabase profile row when this profile maps to a real account. */
  dbProfile?: ProfileRow | null;
  /** Whether the current viewer can edit this profile. */
  canEdit?: boolean;
}

export function ProfileHero({
  user,
  dbProfile = null,
  canEdit,
}: ProfileHeroProps) {
  const followingIds = useZapStore(useShallow((s) => s.followingUserIds));
  const subscribedIds = useZapStore(useShallow((s) => s.subscribedUserIds));
  const toggleFollow = useZapStore((s) => s.toggleFollow);
  const toggleSubscribe = useZapStore((s) => s.toggleSubscribe);
  const override = useZapStore((s) => s.profileOverride);

  const following = followingIds.includes(user.id);
  const subscribed = subscribedIds.includes(user.id);
  const isMe = canEdit ?? user.username === "you";

  const displayName = isMe
    ? override.name || dbProfile?.name || user.name
    : dbProfile?.name || user.name;
  const displayBio = isMe
    ? override.bio ?? dbProfile?.bio ?? user.bio
    : dbProfile?.bio ?? user.bio;
  // Prefer real avatar URL → local override gradient → category gradient.
  const dbAvatarUrl = dbProfile?.avatar_url ?? null;
  const avatarGradient =
    isMe && !dbAvatarUrl && override.avatarGradient
      ? override.avatarGradient
      : undefined;
  const coverGradient = dbProfile?.cover_gradient ?? null;
  const bannerUrl = (dbProfile as { banner_url?: string | null } | null)?.banner_url ?? null;

  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="relative">
      {/* Cover — banner image wins, gradient is fallback. */}
      <div
        className="h-32 lg:h-44 rounded-[14px] relative overflow-hidden"
        style={
          !bannerUrl
            ? {
                background:
                  coverGradient ||
                  `linear-gradient(135deg, ${categoryColor(
                    user.primaryCategory,
                  )}40, #14161D 70%)`,
              }
            : undefined
        }
      >
        {bannerUrl && (
          <>
            <Image
              src={bannerUrl}
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 1280px) 760px, 100vw"
              priority
              unoptimized={bannerUrl.startsWith("data:")}
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A0B0F]/80" />
          </>
        )}
        {!bannerUrl && (
          <>
            <div
              className="absolute -top-20 right-10 w-60 h-60 rounded-full blur-3xl opacity-40"
              style={{ background: categoryColor(user.primaryCategory) }}
            />
            <div
              className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full blur-2xl opacity-30"
              style={{ background: "#FFE600" }}
            />
          </>
        )}
      </div>

      {/* Profile body */}
      <div className="px-4 lg:px-6 -mt-12 lg:-mt-14 relative">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          {dbAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dbAvatarUrl}
              alt={displayName}
              className="h-20 w-20 lg:h-24 lg:w-24 rounded-full object-cover ring-4 ring-[#0A0B0F] bg-[#1A1D26]"
            />
          ) : avatarGradient ? (
            <div
              className="h-20 w-20 lg:h-24 lg:w-24 rounded-full flex items-center justify-center text-[#0A0B0F] font-bold text-3xl ring-4 ring-[#0A0B0F]"
              style={{ background: avatarGradient }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <UserAvatar
              src={user.avatarUrl}
              name={displayName}
              size="xl"
              category={user.primaryCategory}
              score={user.expertScores[user.primaryCategory]}
              showScore={false}
              className="ring-4 ring-[#0A0B0F]"
            />
          )}
          {isMe ? (
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit profile
              </Button>
            </motion.div>
          ) : null}
          {!isMe && (
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  variant={subscribed ? "secondary" : "outline"}
                  onClick={() => toggleSubscribe(user.id)}
                  size="sm"
                >
                  <Bell className={subscribed ? "h-4 w-4 fill-[#FFE600] text-[#FFE600]" : "h-4 w-4"} />
                  {subscribed ? "Subscribed" : "Subscribe"}
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  variant={following ? "secondary" : "default"}
                  onClick={() => {
                    const wasFollowing = following;
                    toggleFollow(user.id);
                    if (!wasFollowing) fireBumpQuest("follow_1");
                  }}
                  size="sm"
                >
                  {following ? (
                    <>
                      <Check className="h-4 w-4" /> Following
                    </>
                  ) : (
                    "Follow"
                  )}
                </Button>
              </motion.div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{displayName}</h1>
            {user.verified && (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-[#FFE600]"
              >
                <path d="M12 2l2.4 2.2 3.2-.4.9 3.1 3 1.3-1.1 3.1 1.4 2.9-2.8 1.7-.4 3.2-3.2.4-2 2.5-2.8-1.5-3 .9-1.3-3-3.1-1 1-3-1.6-2.8 2.6-2 .6-3.1 3.2-.2L12 2zm-1.2 13.4l5.6-5.6-1.4-1.4-4.2 4.2-2-2-1.4 1.4 3.4 3.4z" />
              </svg>
            )}
            <ExpertBadge
              category={user.primaryCategory}
              score={user.expertScores[user.primaryCategory] ?? 50}
              size="md"
            />
          </div>
          <div className="text-[#8B92A8] font-mono text-sm mt-1">@{user.username}</div>
          {/* Item #7 — compact inline followers/following line for parity
              with the rest of the surface. Stat tiles below still render
              the canonical values; this is the quick-glance copy. */}
          <div className="mt-1.5 text-[12.5px] font-mono text-[#8B92A8]">
            <span className="text-white font-semibold">
              {formatLargeNumber(user.followers)}
            </span>{" "}
            Followers
            <span className="text-[#5A6175]"> · </span>
            <span className="text-white font-semibold">
              {user.following.toLocaleString()}
            </span>{" "}
            Following
          </div>
        </div>

        <p className="mt-3 text-[15px] text-[#E5E5E5] max-w-2xl leading-relaxed whitespace-pre-wrap">{displayBio}</p>

        <div className="mt-4 flex items-center gap-2 text-xs font-mono text-[#5A6175]">
          <Calendar className="h-3.5 w-3.5" />
          Joined {format(new Date(user.joined), "MMMM yyyy")}
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#2A2F3D] rounded-md overflow-hidden border border-[#2A2F3D]">
          <Stat label="Followers" value={formatLargeNumber(user.followers)} />
          <Stat label="Following" value={user.following.toLocaleString()} />
          <Stat label="Predictions" value={user.totalPredictions.toLocaleString()} />
          <Stat
            label="Zaps won"
            value={
              <span className="inline-flex items-center gap-1">
                {formatLargeNumber(user.pointsWon)}
                <ZapMark />
              </span>
            }
          />
        </div>
      </div>

      {isMe && (
        <EditProfileModal
          open={editOpen}
          onOpenChange={setEditOpen}
          initialName={displayName}
          initialBio={displayBio ?? ""}
          initialAvatarUrl={dbAvatarUrl}
          initialCoverGradient={coverGradient}
          initialBannerUrl={bannerUrl}
          hasBackend={!!dbProfile}
          username={dbProfile?.username ?? user.username}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[#1A1D26] p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}
