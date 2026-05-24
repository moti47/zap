import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[#2A2F3D] bg-[#20232E] text-[#8B92A8]",
        live:
          "border-[#FFE600]/30 bg-[#FFE600]/10 text-[#FFE600]",
        new:
          "border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800]",
        yes:
          "border-[#00D982]/35 bg-[#00D982]/12 text-[#00D982]",
        no:
          "border-[#FF4757]/35 bg-[#FF4757]/12 text-[#FF4757]",
        outline:
          "border-[#353B4D] bg-transparent text-[#8B92A8]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
