import Link from "next/link";
import { ChevronRight, Clock, Activity, Info } from "lucide-react";
import { notFound } from "next/navigation";
import { getMarket, markets } from "@/lib/mock-data";
import { MarketDetailClient } from "./market-detail-client";

export function generateStaticParams() {
  return markets.map((m) => ({ id: m.id }));
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = getMarket(id);
  if (!market) notFound();

  return <MarketDetailClient market={market} />;
}
