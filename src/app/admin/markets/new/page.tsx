import { requireAdmin } from "@/lib/admin";
import { AdminCreateMarketForm } from "@/components/admin/admin-create-market-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function NewMarketPage() {
  let categoryIdsBySlug: Record<string, string> | undefined;
  if (hasEnv()) {
    await requireAdmin();
    try {
      const supabase = await createClient();
      const { data: rows } = await supabase
        .from("categories")
        .select("id, slug");
      if (rows?.length) {
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
      <AdminCreateMarketForm categoryIdsBySlug={categoryIdsBySlug} />
    </div>
  );
}
