"use client";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type KpiDirection = "higher-better" | "lower-better";

type KpiStatusCardProps = {
  title: string;
  valueLabel: string;
  subtitle: string;
  value: number;
  goodThreshold: number;
  warningThreshold: number;
  direction?: KpiDirection;
};

function getTone(value: number, goodThreshold: number, warningThreshold: number, direction: KpiDirection) {
  if (direction === "higher-better") {
    if (value >= goodThreshold) {
      return "good";
    }
    if (value >= warningThreshold) {
      return "warning";
    }
    return "critical";
  }

  if (value <= goodThreshold) {
    return "good";
  }
  if (value <= warningThreshold) {
    return "warning";
  }
  return "critical";
}

export function KpiStatusCard({
  title,
  valueLabel,
  subtitle,
  value,
  goodThreshold,
  warningThreshold,
  direction = "higher-better",
}: KpiStatusCardProps) {
  const tone = getTone(value, goodThreshold, warningThreshold, direction);

  const toneClass =
    tone === "good" ? "text-[#34A853]" : tone === "warning" ? "text-[#FF9900]" : "text-[#EA4335]";

  return (
    <Card className="war-fade-in war-transition bg-gradient-to-br from-slate-800 to-slate-900">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${toneClass}`}>{valueLabel}</p>
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
