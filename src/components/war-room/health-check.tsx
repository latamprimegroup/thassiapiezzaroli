"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HealthCheckProps = {
  baselineDropRate?: number;
};

export function HealthCheck({ baselineDropRate = 0 }: HealthCheckProps) {
  const [apiLatencyMs, setApiLatencyMs] = useState<number>(0);
  const [navLoadMs, setNavLoadMs] = useState<number>(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      setNavLoadMs(nav ? nav.loadEventEnd - nav.startTime : 0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const start = performance.now();
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("health check fail");
        }
        const end = performance.now();
        if (!cancelled) {
          setApiLatencyMs(end - start);
          setOnline(true);
        }
      } catch {
        if (!cancelled) {
          setOnline(false);
        }
      }
    }

    void ping();
    const interval = window.setInterval(() => void ping(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const pageDropRealtime = useMemo(() => {
    const computed = baselineDropRate + apiLatencyMs / 120 + navLoadMs / 3000;
    return Math.max(0, Math.min(99, computed));
  }, [apiLatencyMs, baselineDropRate, navLoadMs]);

  const tone =
    !online || apiLatencyMs > 900 ? "danger" : apiLatencyMs > 350 || pageDropRealtime > 35 ? "warning" : "success";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-300" />
          Health Check em tempo real
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={tone}>Latencia API: {apiLatencyMs.toFixed(0)}ms</Badge>
          <Badge variant="default">Page Load: {navLoadMs.toFixed(0)}ms</Badge>
          <Badge variant={pageDropRealtime > 30 ? "warning" : "success"}>
            Page Drop (realtime): {pageDropRealtime.toFixed(1)}%
          </Badge>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${
              pageDropRealtime > 35 ? "bg-rose-400" : pageDropRealtime > 20 ? "bg-amber-400" : "bg-emerald-400"
            }`}
            style={{ width: `${pageDropRealtime}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
