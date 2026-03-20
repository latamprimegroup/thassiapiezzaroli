import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-white/20 bg-slate-700/60 text-slate-100",
        success: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100",
        warning: "border-amber-300/40 bg-amber-500/20 text-amber-100",
        danger: "border-rose-300/40 bg-rose-500/20 text-rose-100",
        gold: "border-amber-200/50 bg-amber-500/25 text-amber-50",
        sky: "border-sky-300/40 bg-sky-500/20 text-sky-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
