"use client";

import { Info } from "lucide-react";

type MetricTooltipProps = {
  label: string;
  help: string;
  emphasize?: boolean;
};

export function MetricTooltip({ label, help, emphasize = false }: MetricTooltipProps) {
  return (
    <span className="group relative inline-flex cursor-help items-center gap-1">
      <span className={emphasize ? "text-violet-300" : ""}>{label}</span>
      <Info className="h-3.5 w-3.5 text-slate-400" />
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden max-w-60 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-100 shadow-lg group-hover:block">
        {help}
      </span>
    </span>
  );
}
