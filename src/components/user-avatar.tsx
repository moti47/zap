import Image from "next/image";
import { cn, categoryColor } from "@/lib/utils";
import type { Category } from "@/lib/fixtures";

interface UserAvatarProps {
  src: string | null | undefined;
  name: string;
  category?: Category;
  score?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  verified?: boolean;
  showScore?: boolean;
  /**
   * When the underlying avatar URL changes after an upload we want a
   * cache-bust so every <Image> consumer re-fetches. Pass the
   * `profiles.updated_at` (ISO string) or similar. Optional.
   */
  cacheKey?: string;
  /**
   * Set to true for the topbar avatar / first-screen profile hero, so
   * Next will eagerly fetch + give the image priority.
   */
  priority?: boolean;
}

const sizeMap: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const pixelSize: Record<NonNullable<UserAvatarProps["size"]>, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 80,
};

function withCacheBust(src: string, cacheKey?: string): string {
  if (!cacheKey) return src;
  // Don't append cache-bust to data URLs.
  if (src.startsWith("data:")) return src;
  const join = src.includes("?") ? "&" : "?";
  return `${src}${join}v=${encodeURIComponent(cacheKey)}`;
}

export function UserAvatar({
  src,
  name,
  category,
  score,
  size = "md",
  className,
  showScore = true,
  cacheKey,
  priority = false,
}: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const ringColor = category ? categoryColor(category) : "transparent";
  const ringStyle = category
    ? { boxShadow: `0 0 0 2px ${ringColor}, 0 0 0 4px #1A1D26` }
    : {};
  const px = pixelSize[size];
  const effectiveSrc = src ? withCacheBust(src, cacheKey) : null;
  const isDataUrl = effectiveSrc?.startsWith("data:") ?? false;
  return (
    <div className={cn("relative inline-block flex-shrink-0", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden border border-[#2A2F3D] flex items-center justify-center text-white font-bold",
          sizeMap[size],
          category && "m-[2px]",
        )}
        style={{
          ...ringStyle,
          background: `linear-gradient(135deg, ${
            category ? categoryColor(category) : "#8B92A8"
          }, #14161D)`,
        }}
      >
        {effectiveSrc ? (
          <Image
            src={effectiveSrc}
            alt={name}
            width={px}
            height={px}
            sizes={`${px}px`}
            priority={priority}
            // Data URLs and same-host (Supabase) uploads can skip the
            // Next image optimizer — they're already correctly sized.
            unoptimized={isDataUrl}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs">{initials}</span>
        )}
      </div>
      {showScore && score !== undefined && (
        <span
          className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold num bg-[#0A0B0F] border"
          style={{
            borderColor: ringColor === "transparent" ? "#353B4D" : ringColor,
            color: ringColor === "transparent" ? "#fff" : ringColor,
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}
