import { Suspense } from "react";
import { MarketsCatalog } from "@/components/market/markets-catalog";

/**
 * Public question catalog. The same component is also available as a modal
 * via `AttachMarketDialog` from the composer — `/catalog` is the standalone
 * page you reach by clicking through to the deeper browser.
 */
export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 lg:px-6 py-8">
      <Suspense fallback={null}>
        <MarketsCatalog />
      </Suspense>
    </div>
  );
}
