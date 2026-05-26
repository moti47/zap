import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";
import { getCurrentProfile } from "@/lib/db/profiles";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function OnboardingPage() {
  // Onboarding is for first-time users ONLY. If the signed-in user
  // has already completed it (`profile.onboarded = true`), bounce them
  // straight to the feed so the "1000⚡ welcome" flow never re-shows.
  if (hasEnv()) {
    try {
      const me = await getCurrentProfile();
      if (me?.onboarded) {
        redirect("/");
      }
    } catch {
      // Fall through to render — middleware already gates anonymous.
    }
  }
  return <OnboardingClient />;
}
