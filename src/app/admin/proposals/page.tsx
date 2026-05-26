import { requireAdmin } from "@/lib/admin";
import { listPendingProposals } from "@/lib/db/proposals";
import { ProposalsQueue } from "@/components/admin/proposals-queue";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function AdminProposalsPage() {
  if (hasEnv()) {
    await requireAdmin();
  }
  let pending: Awaited<ReturnType<typeof listPendingProposals>> = [];
  if (hasEnv()) {
    try {
      pending = await listPendingProposals();
    } catch {
      pending = [];
    }
  }
  return (
    <div className="px-4 lg:px-6 py-6 max-w-[820px] mx-auto w-full">
      <ProposalsQueue initialPending={pending} />
    </div>
  );
}
