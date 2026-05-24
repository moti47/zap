import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-[#1A1D26] via-[#20232E] to-[#1A1D26] bg-[length:200%_100%]",
        className
      )}
      style={{ animation: "skeleton-shimmer 1.6s ease-in-out infinite" }}
      {...props}
    />
  );
}

export { Skeleton };
