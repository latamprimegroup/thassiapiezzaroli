"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeKpis } from "@/lib/metrics/kpis";
import type { UserRole } from "@/lib/auth/rbac";
import type { WarRoomData } from "@/lib/war-room/types";

type ActionableInsightsProps = {
  rows: WarRoomData["liveAdsTracking"];
  role: UserRole;
};

type Insight = {
  id: string;
  tone: "critical" | "warning" | "success";
  text: string;
};

function toneVariant(tone: Insight["tone"]) {
  if (tone === "critical") {
    return "danger" as const;
  }
  if (tone === "warning") {
    return "warning" as const;
  }
  return "success" as const;
}

export function ActionableInsights({ rows, role }: ActionableInsightsProps) {
  const insights = useMemo(() => {
    const result: Insight[] = [];
    const analyzed = rows.map((row) => ({ row, kpi: computeKpis(row) }));

    if (analyzed.length === 0) {
      return [
        {
          id: "no-data",
          tone: "warning" as const,
          text: "Sem dados de anuncios para gerar recomendacoes neste momento.",
        },
      ];
    }

    const highHookLowHold = analyzed.find(({ kpi }) => kpi.hookRate >= 30 && kpi.holdRate < 20);
    if (highHookLowHold) {
      result.push({
        id: "high-hook-low-hold",
        tone: "warning",
        text: `Sugestao: Hook Rate alto (${highHookLowHold.kpi.hookRate.toFixed(
          1,
        )}%) com Hold Rate baixo (${highHookLowHold.kpi.holdRate.toFixed(
          1,
        )}%). Peça ao Editor cortes mais rapidos nos primeiros 15s do criativo ${highHookLowHold.row.id}.`,
      });
    }

    const lowHook = analyzed.find(({ kpi }) => kpi.hookRate < 20);
    if (lowHook) {
      result.push({
        id: "low-hook",
        tone: "critical",
        text: `Alerta: ${lowHook.row.id} com Hook Rate ${lowHook.kpi.hookRate.toFixed(
          1,
        )}% abaixo do limite. Reescrever abertura e testar novo angulo de dor.`,
      });
    }

    const winner = analyzed.find(({ row }) => row.roas > 2.5);
    if (winner) {
      result.push({
        id: "winner",
        tone: "success",
        text: `Escala recomendada: ${winner.row.id} com ROAS ${winner.row.roas.toFixed(
          2,
        )}. Duplicar em novo ad set mantendo criativo base.`,
      });
    }

    if (role === "copywriter" || role === "videoEditor") {
      const worstRetention = analyzed.reduce(
        (prev, current) => (current.kpi.holdRate < prev.kpi.holdRate ? current : prev),
        analyzed[0],
      );
      if (worstRetention) {
        result.push({
          id: "retention-focus",
          tone: "warning",
          text: `Foco do perfil: reforcar retencao no ${worstRetention.row.id} (Hold ${worstRetention.kpi.holdRate.toFixed(
            1,
          )}%).`,
        });
      }
    }

    if (result.length === 0) {
      result.push({
        id: "stable",
        tone: "success",
        text: "Operacao estavel: manter iteracao e monitorar desvios de Hook/Hold a cada ciclo.",
      });
    }

    return result.slice(0, 4);
  }, [role, rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recomendacoes da IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight) => (
          <div key={insight.id} className="rounded-md border border-white/10 bg-white/5 p-3">
            <div className="mb-2">
              <Badge variant={toneVariant(insight.tone)}>
                {insight.tone === "critical" ? "Critico" : insight.tone === "warning" ? "Gargalo" : "Acao"}
              </Badge>
            </div>
            <p className="text-sm text-slate-100">{insight.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
