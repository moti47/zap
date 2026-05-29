import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { getMyPositions } from "@/lib/db/trades";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Portfolio — Zap",
  description: "Active prediction-market positions, buy-in cost, and live valuation.",
};

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface ServerPosition {
  id?: string;
  market_id: string;
  side: "YES" | "NO";
  shares: number;
  avg_price: number;
  market?: {
    id: string;
    question: string;
    yes_price: number;
    no_price: number;
    status: string;
    outcome: string | null;
    resolution_date: string | null;
    category?: { slug: string; name: string; color: string } | null;
  } | null;
}

export default async function PortfolioPage() {
  let positions: ServerPosition[] = [];
  let balance = 0;
  let signedIn = false;

  if (hasEnv()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        signedIn = true;
        const [posRes, profileRes] = await Promise.all([
          getMyPositions(),
          supabase.from("profiles").select("zaps").eq("id", user.id).maybeSingle(),
        ]);
        positions = (posRes as ServerPosition[]) ?? [];
        balance = profileRes.data?.zaps ?? 0;
      }
    } catch {
      // fall through to client-side states
    }
  }

  return (
    <div className="mx-auto max-w-[960px] px-4 lg:px-6 py-6 pb-24 lg:pb-8">
      <PortfolioView
        initialPositions={positions}
        initialBalance={balance}
        initialSignedIn={signedIn}
      />
    </div>
  );
}
