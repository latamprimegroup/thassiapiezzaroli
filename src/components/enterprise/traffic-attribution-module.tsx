"use client";

import { useCallback, useEffect, useState } from "react";
import { useWarRoom } from "@/context/war-room-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContingencyMonitor } from "@/components/war-room/contingency-monitor";
import { computeIntelligenceEngine } from "@/lib/metrics/intelligence-engine";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Source = "meta" | "google" | "native";

type TrafficAttributionModuleProps = {
  canInputTrafficSpend: boolean;
  canUseScalingAdvisor: boolean;
  canViewSystemHealthMode: boolean;
  actorName: string;
};

export function TrafficAttributionModule({
  canInputTrafficSpend,
  canUseScalingAdvisor,
  canViewSystemHealthMode,
  actorName,
}: TrafficAttributionModuleProps) {
  const { data, updateTrafficCpa, addActivity } = useWarRoom();
  const [manualDailySpend, setManualDailySpend] = useState({
    meta: data.globalOverview.trafficSources.find((item) => item.source.toLowerCase().includes("meta"))?.spend ?? 0,
    google: data.globalOverview.trafficSources.find((item) => item.source.toLowerCase().includes("google"))?.spend ?? 0,
    tiktok: data.globalOverview.trafficSources.find((item) => item.source.toLowerCase().includes("tiktok"))?.spend ?? 0,
    kwai: data.globalOverview.trafficSources.find((item) => item.source.toLowerCase().includes("kwai"))?.spend ?? 0,
  });
  const [manualMode, setManualMode] = useState(false);
  const [assetWorkflow, setAssetWorkflow] = useState<
    Array<{
      id: string;
      title: string;
      offerId: string;
      status: "aguardando_edicao" | "pronto_para_trafego";
      assignedEditor: string;
      creativeUrl: string;
    }>
  >([]);
  const squads = data.enterprise.trafficAttribution.squads;
  const intelligence = computeIntelligenceEngine(data);
  const killSwitch = data.integrations.operations.killSwitch;
  const maxCpa = Math.max(1, ...intelligence.validatedAssets.map((asset) => asset.effectiveCpa));
  const baselineBySource = {
    meta:
      data.liveAdsTracking.filter((row) => row.squad === "facebook").reduce((acc, row) => acc + row.cpa, 0) /
      Math.max(1, data.liveAdsTracking.filter((row) => row.squad === "facebook").length),
    google:
      data.liveAdsTracking.filter((row) => row.squad === "googleYoutube").reduce((acc, row) => acc + row.cpa, 0) /
      Math.max(1, data.liveAdsTracking.filter((row) => row.squad === "googleYoutube").length),
    native:
      data.liveAdsTracking.filter((row) => row.squad === "tiktok").reduce((acc, row) => acc + row.cpa, 0) /
      Math.max(1, data.liveAdsTracking.filter((row) => row.squad === "tiktok").length),
  };
  const stopLossAlerts = [
    { source: "Meta", current: squads.meta.currentCpa, baseline: baselineBySource.meta },
    { source: "Google", current: squads.google.currentCpa, baseline: baselineBySource.google },
    { source: "Native", current: squads.native.currentCpa, baseline: baselineBySource.native },
  ].filter((item) => item.current > item.baseline * 1.2);
  const bestScalingAsset = data.integrations.attribution.validatedAssets
    .slice()
    .sort((a, b) => a.effectiveCpa - b.effectiveCpa)[0];
  const offersLabApiOnline = data.integrations.apiStatus.utmify.status === "online";
  const effectiveDataMode = manualMode || !offersLabApiOnline ? "manual" : "api";


  function renderSquad(source: Source, label: string) {
    const row = squads[source];
    const cpaTone = row.currentCpa <= row.targetCpa ? "text-[#34A853]" : row.currentCpa <= row.targetCpa * 1.1 ? "text-[#FF9900]" : "text-[#EA4335]";
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-3">
        <p className="text-sm font-medium">{label}</p>
        <p className={`text-sm ${cpaTone}`}>CPA {currency(row.currentCpa)} / Alvo {currency(row.targetCpa)}</p>
        <p className="text-xs text-slate-400">ROAS {row.roas.toFixed(2)} | Estabilidade 48h: {percent(row.stability48h)}</p>
        <input
          type="number"
          step="0.01"
          defaultValue={row.currentCpa}
          disabled={!canInputTrafficSpend}
          onBlur={(event) => {
            if (!canInputTrafficSpend) {
              return;
            }
            updateTrafficCpa(source, Number(event.target.value || row.currentCpa));
            addActivity("Media Buyer", "Gestor Tráfego", "atualizou CPA", label, `novo CPA ${event.target.value}`);
          }}
          className="mt-2 h-8 w-full rounded border border-white/15 bg-slate-900/70 px-2 text-xs"
        />
      </div>
    );
  }

  const fetchAssetWorkflow = useCallback(async () => {
    const response = await fetch("/api/assets/workflow", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as { items?: typeof assetWorkflow } | null;
    if (!payload?.items) {
      return;
    }
    setAssetWorkflow(payload.items);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAssetWorkflow();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAssetWorkflow]);

  return (
    <section className="war-fade-in space-y-4">
      {killSwitch?.autoTrafficBlocked && (
        <Card className="border-rose-300/40 bg-rose-500/10">
          <CardContent className="p-3 text-sm text-rose-100">
            Auto-block ativo: trafego pausado por contingencia ({killSwitch.reason}).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traffic Hub - Input Diário de Gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {canViewSystemHealthMode && (
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-300">
                Saúde do sistema:{" "}
                <span className={effectiveDataMode === "api" ? "text-[#10B981]" : "text-[#FF9900]"}>
                  modo {effectiveDataMode.toUpperCase()}
                </span>{" "}
                {effectiveDataMode === "api" ? "(dados de API ativos)" : "(entrada manual habilitada)"}
              </p>
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-4">
            {(["meta", "google", "tiktok", "kwai"] as const).map((source) => (
              <label key={source} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                <span className="mb-1 block uppercase text-slate-400">{source}</span>
                <input
                  type="number"
                  value={manualDailySpend[source]}
                  onChange={(event) =>
                    setManualDailySpend((prev) => ({
                      ...prev,
                      [source]: Number(event.target.value || 0),
                    }))
                  }
                  className="h-7 w-full rounded border border-white/15 bg-slate-900/70 px-2"
                  disabled={!canInputTrafficSpend}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-7 px-2 text-[11px]"
              disabled={!canInputTrafficSpend}
              onClick={() => {
                setManualMode(true);
                addActivity("Trafego", actorName, "registrou gastos diarios manualmente", "Traffic Hub", JSON.stringify(manualDailySpend));
              }}
            >
              Salvar input manual
            </Button>
            <Button
              type="button"
              className="h-7 px-2 text-[11px]"
              disabled={!canInputTrafficSpend}
              onClick={() => {
                setManualMode(false);
                addActivity("Trafego", actorName, "retornou para modo API", "Traffic Hub", "sincronizacao automatica");
              }}
            >
              Voltar para modo API
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status de Ativo - Pronto para Trafego</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {assetWorkflow
            .filter((asset) => asset.status === "pronto_para_trafego")
            .slice(0, 8)
            .map((asset) => (
              <div key={asset.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">
                  {asset.title} ({asset.offerId})
                </p>
                <p className="text-slate-300">
                  Editor: {asset.assignedEditor || "N/A"} | Link: {asset.creativeUrl || "pendente"}
                </p>
                <Badge variant="success">Pronto para Trafego</Badge>
              </div>
            ))}
          {assetWorkflow.filter((asset) => asset.status === "pronto_para_trafego").length === 0 ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Sem ativos liberados no momento.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Squad Command (Meta, Google, Native)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {renderSquad("meta", "Meta")}
          {renderSquad("google", "Google")}
          {renderSquad("native", "Native")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media Buying Lab - Stop-Loss & Scaling Advisor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {stopLossAlerts.length > 0 ? (
            <div className="rounded border border-[#EA4335]/40 bg-[#EA4335]/10 p-2 text-xs text-rose-100">
              {stopLossAlerts.map((alert) => (
                <p key={alert.source}>
                  STOP-LOSS: {alert.source} com CPA {currency(alert.current)} acima de 20% da media 3h ({currency(alert.baseline)}).
                </p>
              ))}
            </div>
          ) : (
            <Badge variant="success">Stop-loss: nenhum squad acima de +20% vs media das ultimas 3h.</Badge>
          )}
          {bestScalingAsset ? (
            <div className="rounded border border-[#10B981]/30 bg-[#10B981]/10 p-2 text-xs text-emerald-100">
              Scaling Advisor: o ID {bestScalingAsset.assetId} tem LTV alto e melhor eficiencia de CPA. Sugestao: aumentar budget em 15% agora.
            </div>
          ) : null}
          {canUseScalingAdvisor && bestScalingAsset ? (
            <Button
              type="button"
              className="h-7 px-2 text-[11px]"
              onClick={() =>
                addActivity(
                  "Head Midia",
                  actorName,
                  "executou escala em um clique",
                  bestScalingAsset.assetId,
                  "oferta validada >= 70k e ROAS >= 1.8",
                )
              }
            >
              Escalar em 1 clique
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processador de Ativos Validados (Utmify-first)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {intelligence.validatedAssets.map((asset) => {
            const toneClass =
              asset.status === "scale"
                ? "text-[#10B981]"
                : asset.status === "stabilize"
                  ? "text-[#FF9900]"
                  : "text-[#EA4335]";
            const badgeVariant = asset.status === "scale" ? "success" : asset.status === "stabilize" ? "warning" : "danger";
            return (
              <div key={asset.assetId} className="rounded-md border border-white/10 bg-white/5 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{asset.assetId}</p>
                  <Badge variant={badgeVariant}>
                    {asset.status === "scale" ? "VERDE / ESCALA VERTICAL" : asset.status === "stabilize" ? "LARANJA / ESTABILIZACAO" : "VERMELHO / PAUSA"}
                  </Badge>
                </div>
                <p className={`text-xs ${toneClass}`}>
                  CPA entrada: {currency(asset.inputCpa)} | CPA efetivo: {currency(asset.effectiveCpa)} | Fonte:{" "}
                  {asset.trackingSource === "utmifyClickToPurchase" ? "Utmify Click-to-Purchase" : "Facebook API"}
                </p>
                <div className="mt-1 h-2 rounded-full bg-slate-800">
                  <div className={`h-2 rounded-full ${asset.status === "pause" ? "bg-[#EA4335]" : asset.status === "stabilize" ? "bg-[#FF9900]" : "bg-[#10B981]"}`} style={{ width: `${Math.min(100, (asset.effectiveCpa / maxCpa) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">{asset.note}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deep Attribution (Utmify)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.enterprise.trafficAttribution.deepAttribution.map((item) => (
            <div key={`${item.source}-${item.creativeId}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-2 text-sm">
              <span>
                {item.creativeId} - {item.source.toUpperCase()}
              </span>
              <span className="text-[#34A853]">{currency(item.netProfit)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scale Calculator</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            Sugestao DSS de aumento:{" "}
            {intelligence.scalePolicy.locked ? "0.00" : intelligence.scalePolicy.suggestedBudgetIncreasePct.toFixed(2)}%
          </p>
          <p className="text-slate-400">{intelligence.scalePolicy.reason}</p>
          {intelligence.scalePolicy.locked ? (
            <Badge variant="danger" className="mt-2">
              Escala travada por MER abaixo da meta
            </Badge>
          ) : (
            <Badge variant="success" className="mt-2">
              Escala permitida por MER
            </Badge>
          )}
          {intelligence.autoMirrorTriggers.length > 0 && (
            <div className="mt-2 rounded border border-[#FF9900]/40 bg-[#FF9900]/10 p-2 text-xs">
              <p className="mb-1 text-[#FFD39A]">Triggers automáticos para demanda intersetorial:</p>
              {intelligence.autoMirrorTriggers.slice(0, 4).map((trigger) => (
                <p key={trigger.sourceAssetId} className="text-slate-300">
                  {trigger.sourceAssetId}: {trigger.copyTask} + {trigger.editTask} ({trigger.impact.toUpperCase()})
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ContingencyMonitor contingency={data.contingency} />
    </section>
  );
}
