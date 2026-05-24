"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFE600]/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#FFE600] text-[#0A0B0F] hover:bg-[#FFE600]/90 font-bold",
        secondary:
          "bg-[#20232E] text-white border border-[#2A2F3D] hover:border-[#353B4D] hover:bg-[#252834]",
        outline:
          "border border-[#2A2F3D] bg-transparent hover:bg-[#20232E]/60 text-white",
        ghost:
          "bg-transparent hover:bg-[#20232E] text-[#8B92A8] hover:text-white",
        yes: "bg-[#00D982] text-[#0C2418] hover:bg-[#00D982]/90 font-bold",
        no: "bg-[#FF4757] text-white hover:bg-[#FF4757]/90 font-bold",
        yesOutline:
          "border border-[#00D982]/35 bg-[#00D982]/10 text-[#00D982] hover:bg-[#00D982]/15 font-bold",
        noOutline:
          "border border-[#FF4757]/35 bg-[#FF4757]/10 text-[#FF4757] hover:bg-[#FF4757]/15 font-bold",
        destructive: "bg-[#FF4757] text-white hover:bg-[#FF4757]/90",
        link: "text-[#FFE600] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-base",
        xl: "h-12 rounded-md px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
