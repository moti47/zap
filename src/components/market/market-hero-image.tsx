import Image from "next/image";
import { cn, categoryColor } from "@/lib/utils";
import type { Category } from "@/lib/mock-data";

const IMAGE_MAP: Record<Category, string> = {
  politics:
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1600&q=70",
  crypto:
    "https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?auto=format&fit=crop&w=1600&q=70",
  sports:
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=70",
  tech:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=70",
  economy:
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1600&q=70",
  entertainment:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=70",
};

export function MarketHeroImage({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const src = IMAGE_MAP[category];
  const color = categoryColor(category);
  return (
    <div
      className={cn(
        "relative rounded-[14px] overflow-hidden border border-[#2A2F3D] aspect-[3/1] lg:aspect-[5/1]",
        className
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1024px) 880px, 100vw"
        className="object-cover"
        unoptimized
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(0deg, #0A0B0F 5%, transparent 60%), linear-gradient(90deg, ${color}40, transparent 50%)`,
        }}
      />
    </div>
  );
}
