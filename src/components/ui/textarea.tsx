import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full rounded-md border border-[#2A2F3D] bg-[#14161D] px-3 py-2 text-sm transition-colors placeholder:text-[#5A6175] focus-visible:outline-none focus-visible:border-[#353B4D] focus-visible:ring-1 focus-visible:ring-[#FFE600]/30 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
