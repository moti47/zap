import { notFound } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/fixtures";
import { CategoryView } from "./category-view";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!CATEGORIES.includes(slug as Category)) notFound();
  return (
    <div className="mx-auto max-w-[1180px] px-4 lg:px-6 py-8">
      <CategoryView category={slug as Category} />
    </div>
  );
}
