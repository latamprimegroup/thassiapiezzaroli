"use client";

import { useWarRoom } from "@/context/war-room-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContingencyMonitor } from "@/components/war-room/contingency-monitor";
import { computeIntelligenceEngine } from "@/lib/metrics/intelligence-engine";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Source = "meta" | "google" | "native";

export function TrafficAttributionModule() {
  const { data, updateTrafficCpa, addActivity } = useWarRoom();
  const squads = data.enterprise.trafficAttribution.squads;
  const intelligence = computeIntelligenceEngine(data);
  const killSwitch = data.integrations.operations.killSwitch;
  const maxCpa = Math.max(1, ...intelligence.validatedAssets.map((asset) => asset.effectiveCpa));

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
          onBlur={(event) => {
            updateTrafficCpa(source, Number(event.target.value || row.currentCpa));
            addActivity("Media Buyer", "Gestor Tráfego", "atualizou CPA", label, `novo CPA ${event.target.value}`);
          }}
          className="mt-2 h-8 w-full rounded border border-white/15 bg-slate-900/70 px-2 text-xs"
        />
      </div>
    );
  }

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
