import { notFound } from "next/navigation";
import { users, currentUser, type User } from "@/lib/fixtures";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ExpertScoresStrip } from "@/components/profile/expert-scores-strip";
import { CalibrationChart } from "@/components/profile/calibration-chart";
import {
  ProfileTabs,
  type RealProfilePost,
} from "@/components/profile/profile-tabs";
import {
  getCurrentProfile,
  getProfileByUsername,
} from "@/lib/db/profiles";
import { listPostsByAuthor } from "@/lib/db/posts";
import type { ProfileRow } from "@/lib/supabase/types";

export function generateStaticParams() {
  return [...users.map((u) => ({ username: u.username })), { username: "you" }];
}

// Re-evaluate the page per-request so Supabase updates show immediately.
export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: PageParams) {
  const { username } = await params;

  // Look up the live (Supabase) profile when possible. Falls back to mock data
  // so the prototype still renders without a backend.
  let dbProfile: ProfileRow | null = null;
  let dbViewer: ProfileRow | null = null;
  let realPosts: RealProfilePost[] | null = null;

  try {
    dbViewer = await getCurrentProfile();
  } catch {
    dbViewer = null;
  }

  if (username === "you") {
    dbProfile = dbViewer;
  } else {
    try {
      dbProfile = await getProfileByUsername(username);
    } catch {
      dbProfile = null;
    }
  }

  const isMe =
    username === "you" || (!!dbViewer && !!dbProfile && dbViewer.id === dbProfile.id);

  const mockUser: User | undefined =
    username === "you"
      ? currentUser
      : users.find((u) => u.username === username);

  // If we have neither a DB profile nor a mock, this profile genuinely doesn't exist.
  if (!dbProfile && !mockUser) notFound();

  // Merge DB row into the mock User shape so the existing UI keeps working.
  const user: User = mergeUser(mockUser ?? currentUser, dbProfile);

  if (dbProfile) {
    try {
      const rows = await listPostsByAuthor(dbProfile.id, 50);
      realPosts = rows.map((p) => ({
        id: p.id,
        author_id: p.author_id,
        body_html: p.body_html,
        category_slug: p.category?.slug ?? "general",
        market_id: p.market_id,
        images: Array.isArray(p.images) ? p.images : [],
        likes: p.likes,
        comments_count: p.comments_count,
        shares: p.shares,
        created_at: p.created_at,
        boost_zaps: p.boost_zaps,
        boost_until: p.boost_until,
      }));
    } catch {
      realPosts = null;
    }
  }

  return (
    <div className="py-4 pb-24 lg:pb-8 max-w-[1100px] mx-auto w-full">
      <ProfileHero user={user} dbProfile={dbProfile} canEdit={isMe} />
      <div className="px-4 lg:px-6 mt-6">
        <ExpertScoresStrip user={user} />
      </div>
      <div className="px-4 lg:px-6 mt-6">
        <CalibrationChart user={user} />
      </div>
      <div className="px-4 lg:px-6">
        <ProfileTabs user={user} realPosts={realPosts} />
      </div>
    </div>
  );
}

function mergeUser(base: User, db: ProfileRow | null): User {
  if (!db) return base;
  return {
    ...base,
    id: db.id,
    name: db.name || base.name,
    username: db.username || base.username,
    bio: db.bio ?? base.bio,
    avatarUrl: db.avatar_url || base.avatarUrl,
  };
}
