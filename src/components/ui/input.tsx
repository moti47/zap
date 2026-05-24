import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-[#2A2F3D] bg-[#14161D] px-3 py-1 text-sm transition-colors placeholder:text-[#5A6175] focus-visible:outline-none focus-visible:border-[#353B4D] focus-visible:ring-1 focus-visible:ring-[#FFE600]/30 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
