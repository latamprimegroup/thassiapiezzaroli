"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeKpis, isFatigueImminent, isLtvPriority } from "@/lib/metrics/kpis";
import type { UserRole } from "@/lib/auth/rbac";
import type { WarRoomData } from "@/lib/war-room/types";

type ActionableInsightsProps = {
  rows: WarRoomData["liveAdsTracking"];
  role: UserRole;
  contingency: WarRoomData["contingency"];
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

export function ActionableInsights({ rows, role, contingency }: ActionableInsightsProps) {
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

    const highHookLowHold = analyzed.find(({ kpi }) => kpi.hookRate > 25 && kpi.holdRate < 20);
    if (highHookLowHold) {
      result.push({
        id: "high-hook-low-hold",
        tone: "warning",
        text: `Sugestao: Hook Rate alto (${highHookLowHold.kpi.hookRate.toFixed(
          2,
        )}%) com Hold Rate baixo (${highHookLowHold.kpi.holdRate.toFixed(
          2,
        )}%). 💡 Trocar B-Roll/Edicao no minuto 1 do criativo ${highHookLowHold.row.id}.`,
      });
    }

    const highPageDrop = analyzed.find(({ kpi }) => kpi.pageDrop > 30);
    if (highPageDrop) {
      result.push({
        id: "high-page-drop",
        tone: "critical",
        text: `⚡ Page Drop em ${highPageDrop.kpi.pageDrop.toFixed(
          2,
        )}% no ${highPageDrop.row.id}. Otimizar carregamento/imagens da LP imediatamente.`,
      });
    }

    const lowHook = analyzed.find(({ kpi }) => kpi.hookRate < 20);
    if (lowHook) {
      result.push({
        id: "low-hook",
        tone: "critical",
        text: `Alerta: ${lowHook.row.id} com Hook Rate ${lowHook.kpi.hookRate.toFixed(
          2,
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

    const minCpa = analyzed.reduce((min, current) => (current.row.cpa < min ? current.row.cpa : min), Number.POSITIVE_INFINITY);
    const ltvOrdered = analyzed.map((item) => item.row.ltv).sort((a, b) => a - b);
    const ltvThreshold = ltvOrdered.length > 0 ? ltvOrdered[Math.floor(ltvOrdered.length * 0.7)] : 0;
    const ltvPriority = analyzed.find(({ row }) => isLtvPriority(row, minCpa, ltvThreshold));
    if (ltvPriority) {
      result.push({
        id: "ltv-priority",
        tone: "success",
        text: `Prioridade de funil: ${ltvPriority.row.id} traz LTV ${ltvPriority.row.ltv.toLocaleString(
          "pt-BR",
        )} com CPA toleravel. Escalar mesmo com CPA ate 10% acima da base.`,
      });
    }

    const fatigue = analyzed.find(({ row }) => isFatigueImminent(row));
    if (fatigue) {
      result.push({
        id: "fatigue-imminent",
        tone: "warning",
        text: `Fadiga iminente: ${fatigue.row.id} com frequencia subindo e CTR unico caindo por 3 dias. Rotacionar criativo imediatamente.`,
      });
    }

    const blockedEntity = [...contingency.domains, ...contingency.adAccounts, ...contingency.fanpages].find(
      (entity) => entity.status === "blocked" || entity.score < 50,
    );
    if (blockedEntity) {
      result.push({
        id: "contingency-critical",
        tone: "critical",
        text: `Contingencia: ${blockedEntity.name} em estado critico (score ${blockedEntity.score}). Acionar plano de backup agora.`,
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
            2,
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

    return result.slice(0, 6);
  }, [contingency.adAccounts, contingency.domains, contingency.fanpages, role, rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostico Automatico (IA)</CardTitle>
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
