"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { HealthCheck } from "@/components/war-room/health-check";
import { useWarRoom } from "@/context/war-room-context";
import { computeIntelligenceEngine, ELITE_BENCHMARKS } from "@/lib/metrics/intelligence-engine";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function TechCroModule() {
  const { data } = useWarRoom();
  const tech = data.enterprise.techCro;
  const intelligence = computeIntelligenceEngine(data);
  const apiStatus = data.integrations.apiStatus;

  function renderProviderStatus(
    label: string,
    status: "online" | "syncing" | "error",
    trend12h: number[],
    lastSync: string,
    errorMessage: string,
  ) {
    const variant = status === "online" ? "success" : status === "syncing" ? "warning" : "danger";
    const statusLabel = status === "online" ? "ONLINE" : status === "syncing" ? "SYNCING" : "ERROR";
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-slate-200">{label}</p>
          <Badge variant={variant}>{statusLabel}</Badge>
        </div>
        <Sparkline values={trend12h} className="h-7 w-24" strokeClassName={status === "error" ? "stroke-[#EA4335]" : "stroke-[#10B981]"} />
        <p className="mt-1 text-[11px] text-slate-400">Ultimo sync: {lastSync}</p>
        {errorMessage ? <p className="text-[11px] text-rose-300">{errorMessage}</p> : null}
      </div>
    );
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status APIs (Gateway & Attribution)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {renderProviderStatus(
            "Utmify",
            apiStatus.utmify.status,
            apiStatus.utmify.trend12h,
            apiStatus.utmify.lastSync,
            apiStatus.utmify.errorMessage,
          )}
          {renderProviderStatus(
            "Appmax",
            apiStatus.appmax.status,
            apiStatus.appmax.trend12h,
            apiStatus.appmax.lastSync,
            apiStatus.appmax.errorMessage,
          )}
          {renderProviderStatus(
            "Kiwify",
            apiStatus.kiwify.status,
            apiStatus.kiwify.trend12h,
            apiStatus.kiwify.lastSync,
            apiStatus.kiwify.errorMessage,
          )}
          {renderProviderStatus(
            "Yampi",
            apiStatus.yampi.status,
            apiStatus.yampi.trend12h,
            apiStatus.yampi.lastSync,
            apiStatus.yampi.errorMessage,
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LCP Monitor</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className={tech.lcpSeconds <= 1.2 ? "text-[#34A853]" : "text-[#EA4335]"}>
            LCP atual: {tech.lcpSeconds.toFixed(2)}s
          </p>
          {tech.lcpSeconds > 1.2 && <Badge variant="danger">ALERTA: acima de 1.2s</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A/B Test Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tech.abTests.map((test) => (
            <div key={test.test} className="rounded-md border border-white/10 bg-white/5 p-2 text-sm">
              <p>{test.test}</p>
              <p className="text-xs text-slate-400">
                A: {percent(test.variantA)} | B: {percent(test.variantB)} | Winner: {test.winner}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkout Efficiency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Abandono de Carrinho: {percent(tech.checkout.cartAbandonment)}</p>
          <p>Conversao de Checkout: {percent(tech.checkout.checkoutConversion)}</p>
          <p className="text-slate-400">
            IC Rate global DSS: {intelligence.metrics.icRate.toFixed(2)}% (alvo &gt; {ELITE_BENCHMARKS.icRate}%)
          </p>
          {tech.checkout.gatewayAlert && <Badge variant="warning">Gateway com queda de performance</Badge>}
          {tech.checkout.cartAbandonment > 60 && (
            <Badge variant="danger">CRITICAL: abandono de carrinho acima de 60% (Yampi)</Badge>
          )}
          {intelligence.metrics.icRate < ELITE_BENCHMARKS.icRate && (
            <Badge variant="danger">Alerta DSS: friccao detectada em checkout</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upsell Flow Visualizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tech.upsellFlow.map((step) => (
            <div key={step.step}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{step.step}</span>
                <span>{percent(step.clickRate)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-[#FF9900]" style={{ width: `${Math.min(100, step.clickRate)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <HealthCheck baselineDropRate={data.oldSchema?.tech?.pageLoadDropOff ?? 18} />
    </section>
  );
}
