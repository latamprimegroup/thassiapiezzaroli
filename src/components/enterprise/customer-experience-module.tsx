"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";

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
    </section>
  );
}
