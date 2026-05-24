import { cn } from "@/lib/utils";

interface ZapLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  withText?: boolean;
  textClassName?: string;
}

export function ZapLogo({
  className,
  size = "md",
  withText = true,
  textClassName,
}: ZapLogoProps) {
  const dims =
    size === "xl"
      ? { mark: "h-12 w-10", text: "text-4xl" }
      : size === "lg"
      ? { mark: "h-9 w-7", text: "text-2xl" }
      : size === "sm"
      ? { mark: "h-5 w-4", text: "text-base" }
      : { mark: "h-7 w-6", text: "text-xl" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-extrabold tracking-tight text-white",
        className
      )}
    >
      <svg
        viewBox="0 0 24 32"
        fill="none"
        className={dims.mark}
        aria-hidden
      >
        <path
          d="M16 0 L0 18 H9 L7 32 L24 12 H14 L16 0 Z"
          fill="#FFE600"
          stroke="#FFE600"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
      {withText && (
        <span className={cn(dims.text, textClassName)}>Zap</span>
      )}
    </span>
  );
}

export function ZapMark({ className }: { className?: string }) {
  return <i className={cn("zc", className)} aria-hidden />;
}
