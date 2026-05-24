import { Suspense } from "react";
import { MarketsCatalog } from "@/components/market/markets-catalog";

export default function MarketsCatalogPage() {
  return (
    <div className="px-4 lg:px-6 py-6 max-w-[1280px] mx-auto w-full">
      <Suspense fallback={null}>
        <MarketsCatalog />
      </Suspense>
    </div>
  );
}
