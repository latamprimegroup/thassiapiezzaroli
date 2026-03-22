"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { useWarRoom } from "@/context/war-room-context";
import { computeYieldOptimizer } from "@/lib/metrics/corporate-intelligence";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function hoursSince(iso: string) {
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, (Date.now() - value) / (1000 * 60 * 60));
}

export function CustomerExperienceModule() {
  const { data, addActivity } = useWarRoom();
  const yieldOptimizer = useMemo(() => computeYieldOptimizer(data), [data]);
  const [intelligence, setIntelligence] = useState<{
    churnRadar: Array<{
      leadId: string;
      riskScore: number;
      purchases: number;
      refunds: number;
      watchMinutes: number;
      idleHours: number;
      source: string;
      recommendedPlaybook: "welcome_call" | "support_ticket" | "downsell_offer" | "vip_followup";
    }>;
    whaleAlerts: Array<{
      leadId: string;
      totalRevenue: number;
      purchases: number;
      source: string;
      note: string;
    }>;
    retargetGaps: Array<{
      leadId: string;
      source: string;
      utmContent: string;
      maxWatchMinutes: number;
      idleHours: number;
      reason: string;
    }>;
    timeline: Array<{
      leadId: string;
      stage: "cold" | "warm" | "hot" | "buyer";
      watchMinutes: number;
      source: string;
    }>;
  } | null>(null);

  const rows = useMemo(
    () => {
      const leads = data.customerCentrality?.leads ?? [];
      return leads
        .filter((lead) => lead.purchases > 0 || lead.predictedLtv90d > 900)
        .map((lead) => {
          const silentHours = hoursSince(lead.lastTouchAt);
          const needsWelcome = lead.purchases > 0 && silentHours >= 48;
          const churnRisk = lead.purchases > 0 && lead.watchCompletionPct < 30 && silentHours >= 36;
          const upsellTrigger = lead.purchases > 0 && lead.watchCompletionPct >= 65 && lead.awarenessStage !== "unaware";
          return {
            ...lead,
            silentHours,
            needsWelcome,
            churnRisk,
            upsellTrigger,
          };
        })
        .sort((a, b) => b.predictedLtv90d - a.predictedLtv90d)
        .slice(0, 20);
    },
    [data.customerCentrality?.leads],
  );

  useEffect(() => {
    let active = true;
    async function loadIntelligence() {
      const response = await fetch("/api/lead-intelligence/dashboard", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | {
            dashboard?: typeof intelligence;
          }
        | null;
      if (!payload?.dashboard || !active) {
        return;
      }
      setIntelligence(payload.dashboard);
    }
    void loadIntelligence();
    const timer = window.setInterval(() => {
      void loadIntelligence();
    }, 20_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function runPlaybook(leadId: string, action: "welcome_call" | "support_ticket" | "downsell_offer" | "vip_followup") {
    const response = await fetch("/api/lead-intelligence/playbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        action,
        note: "Acionado via radar de churn no modulo CX.",
      }),
    }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    addActivity("CX", "Customer Experience", "acionou playbook de churn", leadId, action);
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Experience & LTV - Satisfaction Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              Sem clientes monitorados no momento.
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.leadId} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-slate-100">{row.leadId}</p>
                  <div className="flex items-center gap-1">
                    {row.needsWelcome ? <Badge variant="warning">SEM ACESSO 48H</Badge> : null}
                    {row.churnRisk ? <Badge variant="danger">RISCO DE CHURN</Badge> : null}
                    {row.upsellTrigger ? <Badge variant="success">UPSELL TRIGGER</Badge> : null}
                  </div>
                </div>
                <p className="text-slate-300">
                  Purchases: {row.purchases} | Silencio: {row.silentHours.toFixed(1)}h | LTV90: {currency(row.predictedLtv90d)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.needsWelcome ? (
                    <Button
                      type="button"
                      className="h-7 px-2 text-[11px]"
                      onClick={() =>
                        addActivity("CX", "Customer Experience", "gerou tarefa boas-vindas manual", row.leadId, "sem acesso por 48h")
                      }
                    >
                      Gerar tarefa de boas-vindas
                    </Button>
                  ) : null}
                  {row.upsellTrigger ? (
                    <Button
                      type="button"
                      className="h-7 px-2 text-[11px]"
                      onClick={() =>
                        addActivity("CX", "Customer Experience", "acionou trigger de upsell", row.leadId, "janela de maior dopamina")
                      }
                    >
                      Acionar oferta de back-end
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The Yield Optimizer (Lead Inventory)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
            <p className="mb-1 text-slate-300">Receita por Lead Adquirido (12 meses)</p>
            <Sparkline
              values={yieldOptimizer.revenuePerLead12m.map((item) => item.value)}
              className="h-10 w-full"
              strokeClassName="stroke-[#10B981]"
            />
            <p className="mt-1 text-slate-400">
              {yieldOptimizer.revenuePerLead12m.map((item) => `${item.month}:${currency(item.value)}`).join(" | ")}
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-1 text-xs text-slate-300">Cross-Sell Recommendation (7 dias sem compra)</p>
              <div className="space-y-1">
                {yieldOptimizer.crossSellRecommendations.length === 0 ? (
                  <p className="text-xs text-slate-500">Sem leads para reciclagem agora.</p>
                ) : (
                  yieldOptimizer.crossSellRecommendations.slice(0, 6).map((item) => (
                    <div key={item.leadId} className="rounded border border-white/10 bg-black/30 p-1.5 text-xs">
                      <p className="text-slate-200">
                        {item.leadId} -&gt; {item.targetTrack}
                      </p>
                      <p className="text-slate-400">
                        {item.reason} | Lift estimado {currency(item.predictedRevenueLift)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-1 text-xs text-slate-300">Lead Recycling Map (Big Idea em queda)</p>
              <div className="space-y-1">
                {yieldOptimizer.leadRecyclingMap.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhuma campanha elegivel para reciclagem.</p>
                ) : (
                  yieldOptimizer.leadRecyclingMap.slice(0, 6).map((item) => (
                    <div key={item.sourceCreativeId} className="rounded border border-white/10 bg-black/30 p-1.5 text-xs">
                      <p className="text-slate-200">
                        {item.sourceCreativeId} -&gt; {item.suggestedTarget}
                      </p>
                      <p className="text-slate-400">{item.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded border border-white/10 bg-white/5 p-2">
            <p className="mb-1 text-xs text-slate-300">Receita de Back-end por Origem</p>
            <div className="space-y-1">
              {yieldOptimizer.backEndRevenueByOrigin.slice(0, 8).map((item) => (
                <div key={item.origin} className="flex items-center justify-between rounded border border-white/10 bg-black/30 p-1.5 text-xs">
                  <span className="text-slate-200">
                    {item.origin} ({item.leads} leads)
                  </span>
                  <span className="text-[#10B981]">{currency(item.predictedBackEndRevenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Churn/Refund Early Warning (MVP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {!intelligence ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Carregando radar de churn...</p>
          ) : (
            intelligence.churnRadar.slice(0, 8).map((lead) => (
              <div key={lead.leadId} className="rounded border border-white/10 bg-white/5 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-slate-100">
                    {lead.leadId} ({lead.source})
                  </p>
                  <Badge variant={lead.riskScore >= 70 ? "danger" : lead.riskScore >= 45 ? "warning" : "success"}>
                    RISCO {lead.riskScore.toFixed(0)}
                  </Badge>
                </div>
                <p className="text-slate-300">
                  Compras: {lead.purchases} | Refunds: {lead.refunds} | Watch: {lead.watchMinutes.toFixed(1)} min | Inativo:{" "}
                  {lead.idleHours.toFixed(1)}h
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => void runPlaybook(lead.leadId, lead.recommendedPlaybook)}
                  >
                    Playbook: {lead.recommendedPlaybook}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Whale Alert + Retarget Gap Report</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-slate-300">Whale Alerts</p>
            {intelligence?.whaleAlerts.slice(0, 6).map((whale) => (
              <div key={whale.leadId} className="rounded border border-white/10 bg-black/30 p-2">
                <p className="text-slate-100">{whale.leadId}</p>
                <p className="text-[#10B981]">
                  {currency(whale.totalRevenue)} | compras {whale.purchases}
                </p>
                <p className="text-slate-400">{whale.note}</p>
              </div>
            ))}
            {(intelligence?.whaleAlerts.length ?? 0) === 0 ? (
              <p className="rounded border border-white/10 bg-black/30 p-2 text-slate-500">Sem whales no periodo.</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">Retarget Gaps</p>
            {intelligence?.retargetGaps.slice(0, 6).map((gap) => (
              <div key={gap.leadId} className="rounded border border-white/10 bg-black/30 p-2">
                <p className="text-slate-100">
                  {gap.leadId} | {gap.utmContent}
                </p>
                <p className="text-slate-300">
                  {gap.maxWatchMinutes.toFixed(1)} min de consumo | idle {gap.idleHours.toFixed(1)}h
                </p>
                <p className="text-slate-400">{gap.reason}</p>
              </div>
            ))}
            {(intelligence?.retargetGaps.length ?? 0) === 0 ? (
              <p className="rounded border border-white/10 bg-black/30 p-2 text-slate-500">Sem gaps de retarget identificados.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
