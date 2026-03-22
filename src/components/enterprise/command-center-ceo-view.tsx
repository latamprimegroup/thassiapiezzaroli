"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionId } from "@/lib/auth/rbac";
import { computeEquityValuation, computeMarketSentimentTracker } from "@/lib/metrics/corporate-intelligence";
import type { WarRoomData } from "@/lib/war-room/types";

type CommandCenterCeoViewProps = {
  data: WarRoomData;
  onDrillDown: (sectionId: SectionId) => void;
  presentationMode: boolean;
};

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function parseTimeToHours(value: string) {
  const [rawHour = "0", rawMinute = "0"] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return Number.NaN;
  }
  return hour + minute / 60;
}

function statusTone(score: "ok" | "attention" | "critical") {
  if (score === "critical") return "border-[#EA4335]/60 bg-[#EA4335]/10";
  if (score === "attention") return "border-[#FF9900]/60 bg-[#FF9900]/10";
  return "border-[#10B981]/40 bg-[#10B981]/10";
}

type SectorCard = {
  id: SectionId;
  title: string;
  tone: "ok" | "attention" | "critical";
  lines: string[];
};

type ApiHubStatusPayload = {
  mode: "auto" | "manual";
  updatedAt: string;
  providers: Array<{ provider: string; status: "api" | "manual" | "missing" }>;
};

export function CommandCenterCeoView({ data, onDrillDown, presentationMode }: CommandCenterCeoViewProps) {
  const [apiHubStatus, setApiHubStatus] = useState<ApiHubStatusPayload | null>(null);
  const mer = data.integrations.merCross.value;
  const netProfit = data.enterprise.ceoFinance.netProfit;
  const equity = computeEquityValuation(data);
  const sentiment = computeMarketSentimentTracker(data);
  const grossRevenue = data.integrations.gateway.consolidatedGrossRevenue;
  const merTrend = data.integrations.merCross.trend12h;
  const avgMer24h = merTrend.length > 0 ? merTrend.reduce((acc, v) => acc + v, 0) / merTrend.length : mer || 1;
  const baseHourlyRevenue = grossRevenue / 24;
  const currentHourlyRevenue = baseHourlyRevenue * (mer / Math.max(0.1, avgMer24h));
  const salesVelocityDeltaPct = ((currentHourlyRevenue - baseHourlyRevenue) / Math.max(1, baseHourlyRevenue)) * 100;

  const copyBestIdea = [...data.enterprise.copyResearch.bigIdeaVault].sort(
    (a, b) => (b.assetValue ?? 0) - (a.assetValue ?? 0),
  )[0];
  const ideasReady = data.enterprise.copyResearch.bigIdeaVault.filter((item) => item.saturation < 70).length;
  const ideasResearch = Math.max(0, data.enterprise.copyResearch.bigIdeaVault.length - ideasReady);

  const topRoi = [...data.integrations.attribution.realRoiLeaderboard].sort((a, b) => b.realRoas - a.realRoas).slice(0, 3);
  const fatigueCount = data.liveAdsTracking.filter((row) => row.frequency > 2.2 && row.roas < 2.2).length;

  const testsDone = data.creativeFactory.tasks.filter((task) => task.status === "Teste" || task.status === "Winner").length;
  const testGoal = 15;
  const scriptsWaitingEdit = data.creativeFactory.tasks.filter((task) => task.status === "Roteiro").length;

  const sniper90 = (data.customerCentrality?.leads ?? []).filter(
    (lead) => lead.purchases === 0 && lead.watchCompletionPct >= 70 && lead.predictedLtv90d >= 1500,
  ).length;
  const avgRecoveryRate =
    data.enterprise.ceoFinance.recoveryLeaderboard.length > 0
      ? data.enterprise.ceoFinance.recoveryLeaderboard.reduce(
          (acc, item) => acc + (item.boletoRecoveryRate + item.pixRecoveryRate) / 2,
          0,
        ) / data.enterprise.ceoFinance.recoveryLeaderboard.length
      : 0;

  const refundRate = Math.max(0.2, Math.min(18, 2 + data.integrations.gateway.yampiCartAbandonmentRate / 18));
  const avgPredictedLtv =
    (data.customerCentrality?.awarenessDistribution ?? []).reduce((acc, row) => acc + row.avgPredictedLtv90d, 0) /
    Math.max(1, (data.customerCentrality?.awarenessDistribution ?? []).length);

  const blockedDomains = data.integrations.fortress.vault.domains.filter((domain) => domain.status === "blocked").length;
  const apiErrorCount = Object.values(data.integrations.apiStatus).filter((provider) => provider.status === "error").length;
  const checkoutUptimePct = Math.max(90, 100 - data.enterprise.techCro.checkout.cartAbandonment / 2);

  const sectorCards = useMemo<SectorCard[]>(
    () => [
      {
        id: "copyResearch",
        title: "SQUAD COPY (Intellectual Property)",
        tone: ideasReady > ideasResearch ? "ok" : "attention",
        lines: [
          `Big Idea mais lucrativa: ${copyBestIdea?.title ?? "N/A"} (${currency(copyBestIdea?.assetValue ?? 0)})`,
          `Vault: ${ideasResearch} em pesquisa | ${ideasReady} prontas para trafego`,
        ],
      },
      {
        id: "trafficAttribution",
        title: "SQUAD MIDIA (Scaling Engine)",
        tone: fatigueCount > 1 ? "attention" : "ok",
        lines: [
          `Top IDs ROI: ${topRoi.map((item) => `${item.creativeId} (${item.realRoas.toFixed(2)}x)`).join(" | ") || "N/A"}`,
          `Alertas de fadiga: ${fatigueCount} (frequencia > 2.2)`,
        ],
      },
      {
        id: "editorsProduction",
        title: "SQUAD EDICAO (Creative Factory)",
        tone: scriptsWaitingEdit > 4 ? "attention" : "ok",
        lines: [
          `Meta testes diarios: ${testsDone}/${testGoal}`,
          `Gargalo de edicao: ${scriptsWaitingEdit} roteiros aguardando`,
        ],
      },
      {
        id: "salesRecovery",
        title: "SQUAD COMERCIAL (The Snipers)",
        tone: sniper90 >= 3 ? "ok" : "attention",
        lines: [
          `Leads score 90+ aguardando contato: ${sniper90}`,
          `Taxa media de recuperacao hoje: ${avgRecoveryRate.toFixed(2)}%`,
        ],
      },
      {
        id: "customerExperience",
        title: "SQUAD CUSTOMER EXPERIENCE (LTV)",
        tone: refundRate > 8 ? "critical" : refundRate > 5 ? "attention" : "ok",
        lines: [
          `Refund Rate (tempo real): ${refundRate.toFixed(2)}%`,
          `LTV preditivo medio da safra: ${currency(avgPredictedLtv)}`,
        ],
      },
      {
        id: "techCro",
        title: "SQUAD TECH & COMPLIANCE (Security)",
        tone: blockedDomains > 0 || apiErrorCount > 0 ? "critical" : "ok",
        lines: [
          `Dominios em risco: ${blockedDomains} | APIs em erro: ${apiErrorCount}`,
          `Checkout/Gateway uptime estimado: ${checkoutUptimePct.toFixed(2)}%`,
        ],
      },
    ],
    [
      apiErrorCount,
      avgPredictedLtv,
      avgRecoveryRate,
      blockedDomains,
      checkoutUptimePct,
      copyBestIdea?.assetValue,
      copyBestIdea?.title,
      fatigueCount,
      ideasReady,
      ideasResearch,
      refundRate,
      scriptsWaitingEdit,
      sniper90,
      testGoal,
      testsDone,
      topRoi,
    ],
  );

  const criticalEvents = useMemo(() => {
    const events: Array<{ level: "critical" | "success" | "warning"; message: string; icon: "shield" | "up" | "alert" | "zap" }> = [];
    if (blockedDomains > 0) {
      events.push({
        level: "critical",
        icon: "shield",
        message: `ALERTA: ${blockedDomains} dominio(s) com status inseguro. Trafego pausado para protecao.`,
      });
    }
    const roiWinner = topRoi.find((item) => item.realRoas >= 5);
    if (roiWinner) {
      events.push({
        level: "success",
        icon: "up",
        message: `SUCESSO: ${roiWinner.creativeId} atingiu ROI ${roiWinner.realRoas.toFixed(2)}x. Sugestao de escala vertical.`,
      });
    }
    const lastEditHour = data.creativeFactory.tasks
      .filter((task) => task.status === "Edicao" || task.status === "Teste" || task.status === "Winner")
      .map((task) => parseTimeToHours(task.updatedAt))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0];
    if (Number.isFinite(lastEditHour)) {
      const now = new Date();
      const nowHours = now.getHours() + now.getMinutes() / 60;
      const diff = nowHours - (lastEditHour ?? nowHours);
      if (diff >= 12) {
        events.push({
          level: "warning",
          icon: "alert",
          message: "ATENCAO: Time de Edicao sem novos hooks nas ultimas 12h.",
        });
      }
    }
    if (data.integrations.operations.killSwitch?.active) {
      events.push({
        level: "critical",
        icon: "zap",
        message: `KILL SWITCH ATIVO: ${data.integrations.operations.killSwitch.reason}`,
      });
    }
    if (sentiment.demandMoreSophisticated) {
      events.push({
        level: "warning",
        icon: "alert",
        message: "MERCADO VACINANDO PROMESSA DIRETA: migrar copy para mecanismo indireto (historia/segredo).",
      });
    }
    return events.slice(0, 8);
  }, [blockedDomains, data.creativeFactory.tasks, data.integrations.operations.killSwitch, sentiment.demandMoreSophisticated, topRoi]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch("/api/admin/api-hub?view=status", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as ApiHubStatusPayload | null;
      if (!payload || !active) {
        return;
      }
      setApiHubStatus(payload);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-white/10 bg-[#050505]">
        <CardHeader>
          <CardTitle className="text-base">THE COMMAND CENTER (CEO VIEW 10D)</CardTitle>
        </CardHeader>
        <CardContent className={`grid gap-3 ${presentationMode ? "md:grid-cols-4" : "md:grid-cols-4 xl:grid-cols-4"}`}>
          <div className={`rounded border p-3 ${mer < 2.5 ? "animate-pulse border-[#EA4335]/70 bg-[#EA4335]/10" : "border-[#10B981]/40 bg-[#10B981]/10"}`}>
            <p className="text-xs text-slate-300">MER Global (Real-time)</p>
            <p className="text-2xl font-semibold text-white">{mer.toFixed(2)}x</p>
            <p className="text-[11px] text-slate-400">Faturamento Bruto / Gasto Ads</p>
          </div>
          <div className="rounded border border-[#10B981]/40 bg-[#10B981]/10 p-3">
            <p className="text-xs text-slate-300">Net Profit (Live)</p>
            <p className="text-2xl font-semibold text-white">{currency(netProfit)}</p>
            <p className="text-[11px] text-slate-400">Liquido com taxas, impostos e adspend</p>
          </div>
          <div className={`rounded border p-3 ${salesVelocityDeltaPct < 0 ? "border-[#FF9900]/50 bg-[#FF9900]/10" : "border-[#10B981]/40 bg-[#10B981]/10"}`}>
            <p className="text-xs text-slate-300">Sales Velocity</p>
            <p className="text-2xl font-semibold text-white">{currency(currentHourlyRevenue)}/h</p>
            <p className="text-[11px] text-slate-400">
              vs media 24h ({salesVelocityDeltaPct >= 0 ? "+" : ""}
              {salesVelocityDeltaPct.toFixed(1)}%)
            </p>
          </div>
          <div className="rounded border border-[#10B981]/40 bg-[#10B981]/10 p-3">
            <p className="text-xs text-slate-300">Valor de Mercado Estimado da Holding</p>
            <p className="text-2xl font-semibold text-white">{currency(equity.estimatedValuation)}</p>
            <p className="text-[11px] text-slate-400">
              Equity 12m + sentimento {sentiment.demandMoreSophisticated ? "exige tese sofisticada" : "estavel"}
            </p>
          </div>
        </CardContent>
      </Card>

      {apiHubStatus && (
        <Card className="border-white/10 bg-[#050505]">
          <CardHeader>
            <CardTitle className="text-sm">Saúde do Sistema (API vs Manual)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-slate-300">
              Modo operacional:{" "}
              <span className={apiHubStatus.mode === "auto" ? "text-[#10B981]" : "text-[#FF9900]"}>
                {apiHubStatus.mode === "auto" ? "API" : "MANUAL"}
              </span>
            </p>
            <div className="grid gap-1 md:grid-cols-5">
              {apiHubStatus.providers.map((provider) => (
                <div key={provider.provider} className="rounded border border-white/10 bg-white/5 p-2">
                  <p className="uppercase text-slate-400">{provider.provider}</p>
                  <p
                    className={
                      provider.status === "api"
                        ? "text-[#10B981]"
                        : provider.status === "manual"
                          ? "text-[#FF9900]"
                          : "text-[#EA4335]"
                    }
                  >
                    {provider.status.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-4 ${presentationMode ? "2xl:grid-cols-[1fr_340px]" : "2xl:grid-cols-[1fr_360px]"}`}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sectorCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onDrillDown(card.id)}
              className={`rounded-lg border p-3 text-left transition hover:scale-[1.01] ${statusTone(card.tone)}`}
            >
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-300">{card.title}</p>
              {card.lines.map((line) => (
                <p key={line} className="text-[12px] text-slate-100">
                  {line}
                </p>
              ))}
              <p className="mt-2 text-[10px] text-slate-400">Clique para drill-down</p>
            </button>
          ))}
        </div>

        <Card className="border-white/10 bg-[#050505]">
          <CardHeader>
            <CardTitle className="text-base">THE SIREN - Eventos Criticos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalEvents.length === 0 ? (
              <div className="rounded border border-white/10 bg-white/5 p-2 text-xs text-slate-400">Sem eventos criticos no momento.</div>
            ) : (
              criticalEvents.map((event, index) => (
                <div
                  key={`${event.level}-${index}`}
                  className={`rounded border p-2 text-xs ${
                    event.level === "critical"
                      ? "border-[#EA4335]/50 bg-[#EA4335]/10 text-rose-100"
                      : event.level === "success"
                        ? "border-[#10B981]/40 bg-[#10B981]/10 text-emerald-100"
                        : "border-[#FF9900]/40 bg-[#FF9900]/10 text-amber-100"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1">
                    {event.icon === "shield" ? <ShieldAlert className="h-3.5 w-3.5" /> : null}
                    {event.icon === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                    {event.icon === "alert" ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                    {event.icon === "zap" ? <Zap className="h-3.5 w-3.5" /> : null}
                    <Badge variant={event.level === "critical" ? "danger" : event.level === "success" ? "success" : "warning"}>
                      {event.level.toUpperCase()}
                    </Badge>
                  </div>
                  <p>{event.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
