import Image from "next/image";
import { cn, categoryColor } from "@/lib/utils";
import type { Category } from "@/lib/mock-data";

interface UserAvatarProps {
  src: string;
  name: string;
  category?: Category;
  score?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  verified?: boolean;
  showScore?: boolean;
}

const sizeMap = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

export function UserAvatar({
  src,
  name,
  category,
  score,
  size = "md",
  className,
  showScore = true,
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
  return (
    <div className={cn("relative inline-block flex-shrink-0", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden border border-[#2A2F3D] flex items-center justify-center text-white font-bold",
          sizeMap[size],
          category && "m-[2px]"
        )}
        style={{
          ...ringStyle,
          background: `linear-gradient(135deg, ${
            category ? categoryColor(category) : "#8B92A8"
          }, #14161D)`,
        }}
      >
        {src ? (
          <Image
            src={src}
            alt={name}
            width={80}
            height={80}
            className="h-full w-full object-cover"
            unoptimized
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
