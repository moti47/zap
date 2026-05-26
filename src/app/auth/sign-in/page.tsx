import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in — Zap" };

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  // Only consult Supabase when the env is configured — otherwise the
  // page is a static preview of the sign-in form (used in the demo
  // build without a backend wired).
  if (hasEnv()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(params.next ?? "/feed");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1D26] p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-white/60">
          Predict the future. Earn for being right.
        </p>

        <SignInForm next={params.next ?? "/feed"} initialError={params.error} />

        <p className="mt-6 text-center text-sm text-white/60">
          New here?{" "}
          <Link
            href={`/auth/sign-up${params.next ? `?next=${encodeURIComponent(params.next)}` : ""}`}
            className="text-yellow-400 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
