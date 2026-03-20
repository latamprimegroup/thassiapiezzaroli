"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthCheck } from "@/components/war-room/health-check";
import { useWarRoom } from "@/context/war-room-context";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function TechCroModule() {
  const { data } = useWarRoom();
  const tech = data.enterprise.techCro;

  return (
    <section className="war-fade-in space-y-4">
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
          {tech.checkout.gatewayAlert && <Badge variant="warning">Gateway com queda de performance</Badge>}
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
