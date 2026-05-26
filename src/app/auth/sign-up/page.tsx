import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Sign up — Zap" };

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  if (hasEnv()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(params.next ?? "/feed");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1D26] p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-white/60">
          Start with 50 ⚡ — earn more by completing daily quests.
        </p>

        <SignUpForm next={params.next ?? "/onboarding"} />

        <p className="mt-6 text-center text-sm text-white/60">
          Already have an account?{" "}
          <Link
            href={`/auth/sign-in${params.next ? `?next=${encodeURIComponent(params.next)}` : ""}`}
            className="text-yellow-400 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
