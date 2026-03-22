import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-9 w-full rounded-md border border-white/15 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
