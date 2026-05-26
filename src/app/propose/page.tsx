import { ProposeMarketView } from "@/components/propose/propose-market-view";
import { listMyProposals } from "@/lib/db/proposals";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function ProposePage() {
  let mine: Awaited<ReturnType<typeof listMyProposals>> = [];
  let categoryIdsBySlug: Record<string, string> | undefined;

  if (hasEnv()) {
    // Parallel: proposal list + category id lookup. The form needs
    // the uuid for category_id; without it the submit short-circuits
    // into "preview mode".
    const supabase = await createClient();
    try {
      const [proposalsResult, categoriesResult] = await Promise.all([
        listMyProposals(),
        supabase.from("categories").select("id, slug"),
      ]);
      mine = proposalsResult;
      const rows = categoriesResult.data ?? [];
      if (rows.length) {
        categoryIdsBySlug = {};
        for (const r of rows) {
          categoryIdsBySlug[r.slug as string] = r.id as string;
        }
      }
    } catch {
      // Fall through to demo mode.
    }
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-[820px] mx-auto w-full">
      <ProposeMarketView
        initialProposals={mine}
        categoryIdsBySlug={categoryIdsBySlug}
      />
    </div>
  );
}
