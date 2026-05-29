import { PortfolioView } from "@/components/portfolio/portfolio-view";

// Render per-request so live prices + position changes never get
// stale-cached behind the user.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Portfolio — Zap",
  description: "Active prediction-market positions, buy-in cost, and live valuation.",
};

export default function PortfolioPage() {
  return (
    <div className="mx-auto max-w-[960px] px-4 lg:px-6 py-6 pb-24 lg:pb-8">
      <PortfolioView />
    </div>
  );
}
