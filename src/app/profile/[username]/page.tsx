import { notFound } from "next/navigation";
import { users, currentUser } from "@/lib/mock-data";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ExpertScoresStrip } from "@/components/profile/expert-scores-strip";
import { CalibrationChart } from "@/components/profile/calibration-chart";
import { ProfileTabs } from "@/components/profile/profile-tabs";

export function generateStaticParams() {
  return [...users.map((u) => ({ username: u.username })), { username: "you" }];
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = username === "you" ? currentUser : users.find((u) => u.username === username);
  if (!user) notFound();

  return (
    <div className="py-4 pb-24 lg:pb-8 max-w-[1100px] mx-auto w-full">
      <ProfileHero user={user} />
      <div className="px-4 lg:px-6 mt-6">
        <ExpertScoresStrip user={user} />
      </div>
      <div className="px-4 lg:px-6 mt-6">
        <CalibrationChart user={user} />
      </div>
      <div className="px-4 lg:px-6">
        <ProfileTabs user={user} />
      </div>
    </div>
  );
}
