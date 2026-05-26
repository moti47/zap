import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { listPendingProposals } from "@/lib/db/proposals";
import { ShieldCheck, PlusCircle, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function AdminHome() {
  // Middleware already gates this, but defense-in-depth: throw here if
  // the call somehow bypasses middleware.
  if (hasEnv()) {
    await requireAdmin();
  }

  let pendingCount = 0;
  if (hasEnv()) {
    try {
      const pending = await listPendingProposals();
      pendingCount = pending.length;
    } catch {
      pendingCount = 0;
    }
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-[820px] mx-auto w-full space-y-6">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600] inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          Admin tools
        </h1>
        <p className="text-[13px] text-[#8B92A8] mt-1 max-w-[560px]">
          Create markets directly or review community-submitted proposals.
          Restricted to the configured ADMIN_USER_ID.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/markets/new"
          className="group rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 hover:border-[#FFE600]/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="h-9 w-9 rounded-[10px] grid place-items-center bg-[#FFE600]/15 border border-[#FFE600]/30 text-[#FFE600]">
              <PlusCircle className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-white">Create market</h2>
          </div>
          <p className="text-[12px] text-[#8B92A8]">
            Spin up a new binary market with question, category, resolution
            date, source, and initial YES price.
          </p>
        </Link>

        <Link
          href="/admin/proposals"
          className="group rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 hover:border-[#FFE600]/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="h-9 w-9 rounded-[10px] grid place-items-center bg-[#4DA3FF]/15 border border-[#4DA3FF]/30 text-[#4DA3FF]">
              <ListChecks className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-white inline-flex items-center gap-2">
              Review proposals
              {pendingCount > 0 && (
                <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#FFB800] text-[#0A0B0F]">
                  {pendingCount} pending
                </span>
              )}
            </h2>
          </div>
          <p className="text-[12px] text-[#8B92A8]">
            Approve or reject community-submitted market proposals.
            Approval creates a live market with the proposer as creator.
          </p>
        </Link>
      </div>
    </div>
  );
}
