import Link from "next/link";
import { cn, categoryColor } from "@/lib/utils";
import type { Category } from "@/lib/mock-data";

interface ExpertBadgeProps {
  category: Category;
  score: number;
  size?: "sm" | "md";
  className?: string;
}

export function ExpertBadge({
  category,
  score,
  size = "sm",
  className,
}: ExpertBadgeProps) {
  const color = categoryColor(category);
  return (
    <span
      className={cn(
        "inline-flex items-stretch rounded-full overflow-hidden font-mono font-semibold border border-[#2A2F3D] bg-[#20232E] leading-none",
        size === "sm" ? "text-[10px]" : "text-xs",
        className
      )}
      style={{ boxShadow: `inset 2px 0 0 ${color}` }}
    >
      <span
        className={cn(
          "px-2 text-white tabular-nums",
          size === "sm" ? "py-1" : "py-1.5"
        )}
      >
        {score}
      </span>
      <span
        className={cn(
          "px-2 text-[#8B92A8] uppercase tracking-wider border-l border-[#2A2F3D]",
          size === "sm" ? "text-[9px] py-1" : "text-[10px] py-1.5"
        )}
      >
        {category}
      </span>
    </span>
  );
}

export function CategoryTag({
  category,
  className,
  asLink = true,
}: {
  category: Category;
  className?: string;
  /** When true (default), the tag is a Link to /category/[slug]. */
  asLink?: boolean;
}) {
  const inner = (
    <>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: categoryColor(category) }}
      />
      {category}
    </>
  );
  const styles = cn(
    "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider",
    asLink && "hover:underline underline-offset-2 decoration-1",
    className
  );
  const style = { color: categoryColor(category) };
  if (!asLink) {
    return (
      <span className={styles} style={style}>
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={`/category/${category}`}
      className={styles}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {inner}
    </Link>
  );
}

export function LivePulseDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full bg-[#FFE600] shadow-[0_0_10px_#FFE600]",
        className
      )}
      style={{ animation: "pulse-zap 1.6s ease-in-out infinite" }}
    />
  );
}
