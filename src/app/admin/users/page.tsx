import { requireAdmin } from "@/lib/admin";
import { listAllUsersForAdmin } from "@/lib/db/admin-users";
import { ShieldCheck, Users } from "lucide-react";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface SearchParams {
  q?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (hasEnv()) {
    await requireAdmin();
  }
  const params = await searchParams;
  const q = (params.q ?? "").toString();

  let users: Awaited<ReturnType<typeof listAllUsersForAdmin>> = [];
  let loadError: string | null = null;
  if (hasEnv()) {
    try {
      users = await listAllUsersForAdmin(q, 200);
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-[1180px] mx-auto w-full space-y-6">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600] inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin · Users
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 inline-flex items-center gap-2">
          <Users className="h-6 w-6 text-[#FFE600]" />
          User management
        </h1>
        <p className="text-[13px] text-[#8B92A8] mt-1 max-w-[640px]">
          Adjust role, account status, and Zap balance for every registered
          profile. Changes write directly to <code className="font-mono">public.profiles</code>{" "}
          via the service-role client and revalidate immediately.
        </p>
      </header>

      {loadError && (
        <div className="rounded-[10px] border border-[#FF4757]/40 bg-[#FF4757]/10 px-4 py-3 text-[12.5px] text-[#FF4757] font-mono">
          Failed to load users: {loadError}
        </div>
      )}

      <UsersTable initialUsers={users} initialQuery={q} />
    </div>
  );
}
