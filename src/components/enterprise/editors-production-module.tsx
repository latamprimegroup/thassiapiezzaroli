"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreativeFactoryBoard } from "@/components/war-room/creative-factory-board";
import { LiveAdsTable } from "@/components/war-room/live-ads-table";
import { useWarRoom } from "@/context/war-room-context";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

type EditorsProductionModuleProps = {
  canShowRoas: boolean;
  emphasizeRetention: boolean;
  simplified: boolean;
  canManageProductionQueue: boolean;
  actorName: string;
};

export function EditorsProductionModule({
  canShowRoas,
  emphasizeRetention,
  simplified,
  canManageProductionQueue,
  actorName,
}: EditorsProductionModuleProps) {
  const { data, addActivity } = useWarRoom();
  const editors = data.enterprise.editorsProduction;
  const roiRanking = data.integrations.attribution.realRoiLeaderboard.slice(0, 6);
  const [pipelineBodyId, setPipelineBodyId] = useState(data.liveAdsTracking[0]?.id ?? "");
  const [newHookVariation, setNewHookVariation] = useState("");
  const [hookVariations, setHookVariations] = useState<string[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [deliveryDraft, setDeliveryDraft] = useState({
    utmId: data.enterprise.copyResearch.namingRegistry[0]?.uniqueId ?? "ID0000",
    assetUrl: "",
  });
  const [deliveries, setDeliveries] = useState<Array<{ utmId: string; assetUrl: string; at: string }>>([]);
  const priorityQueue = useMemo(
    () =>
      data.liveAdsTracking
        .map((row) => ({
          ...row,
          impactScore: (row.roas * row.ltv) / Math.max(1, row.cpa),
        }))
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, 8),
    [data.liveAdsTracking],
  );
  const bestRetentionAssets = useMemo(
    () =>
      data.liveAdsTracking
        .map((row) => ({
          id: row.id,
          name: row.adName,
          holdRate: (row.views15s / Math.max(1, row.views3s)) * 100,
        }))
        .sort((a, b) => b.holdRate - a.holdRate)
        .filter((row) => row.id.toLowerCase().includes(assetSearch.toLowerCase()) || row.name.toLowerCase().includes(assetSearch.toLowerCase()))
        .slice(0, 12),
    [assetSearch, data.liveAdsTracking],
  );
  const productionQueue = useMemo(
    () =>
      data.commandCenter.tasks
        .filter((task) => task.department === "editorsCreative" && task.status !== "done")
        .sort((a, b) => {
          const rank = { critical: 3, high: 2, medium: 1, low: 0 };
          return rank[b.impact] - rank[a.impact];
        })
        .slice(0, 8),
    [data.commandCenter.tasks],
  );

  function addHookVariation() {
    const value = newHookVariation.trim();
    if (!value || hookVariations.length >= 10) {
      return;
    }
    setHookVariations((prev) => [...prev, value]);
    setNewHookVariation("");
    addActivity("Edicao", "Creative Factory", "adicionou variacao de hook", pipelineBodyId, value);
  }

  function saveDelivery() {
    const url = deliveryDraft.assetUrl.trim();
    if (!url) {
      return;
    }
    const entry = {
      utmId: deliveryDraft.utmId,
      assetUrl: url,
      at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    setDeliveries((prev) => [entry, ...prev].slice(0, 10));
    setDeliveryDraft((prev) => ({ ...prev, assetUrl: "" }));
    addActivity("Producao", actorName, "subiu criativo final", entry.utmId, entry.assetUrl);
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creative Factory - Fila de Produção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {productionQueue.length === 0 ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Sem demandas pendentes para edição.</p>
          ) : (
            productionQueue.map((task) => (
              <div key={task.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">{task.title}</p>
                <p className="text-slate-400">{task.description}</p>
                <Badge variant={task.impact === "critical" ? "danger" : "warning"}>
                  Prioridade: {task.impact.toUpperCase()}
                </Badge>
              </div>
            ))
          )}
          {!canManageProductionQueue && <p className="text-slate-500">Permissão de gestão de fila restrita ao squad de produção.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload do Criativo Final (Drive/Vimeo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
            <select
              value={deliveryDraft.utmId}
              onChange={(event) => setDeliveryDraft((prev) => ({ ...prev, utmId: event.target.value }))}
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
              disabled={!canManageProductionQueue}
            >
              {data.enterprise.copyResearch.namingRegistry.slice(0, 80).map((item) => (
                <option key={item.id} value={item.uniqueId}>
                  {item.uniqueId} | {item.dnaName}
                </option>
              ))}
            </select>
            <input
              value={deliveryDraft.assetUrl}
              onChange={(event) => setDeliveryDraft((prev) => ({ ...prev, assetUrl: event.target.value }))}
              placeholder="https://drive.google.com/... ou https://vimeo.com/..."
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
              disabled={!canManageProductionQueue}
            />
            <Button type="button" className="h-8 px-3 text-[11px]" onClick={saveDelivery} disabled={!canManageProductionQueue}>
              Vincular
            </Button>
          </div>
          <div className="space-y-1">
            {deliveries.map((item) => (
              <div key={`${item.utmId}-${item.at}`} className="rounded border border-white/10 bg-black/30 p-2">
                <p className="text-slate-200">
                  {item.utmId} | {item.at}
                </p>
                <p className="text-slate-400">{item.assetUrl}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fila de Prioridade por Impacto Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {priorityQueue.map((item, index) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
              <div className="flex items-center justify-between">
                <p className="text-slate-100">
                  #{index + 1} {item.id} - {item.adName}
                </p>
                <Badge variant={index < 3 ? "danger" : "warning"}>{index < 3 ? "IMPACTO MAXIMO" : "ALTO IMPACTO"}</Badge>
              </div>
              <p className="text-slate-400">
                Score: {item.impactScore.toFixed(2)} | ROAS {item.roas.toFixed(2)} | LTV {item.ltv.toFixed(0)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hook Testing Pipeline (10 variacoes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
            <select
              value={pipelineBodyId}
              onChange={(event) => setPipelineBodyId(event.target.value)}
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
            >
              {data.liveAdsTracking.map((row) => (
                <option key={row.id} value={row.id}>
                  Corpo base: {row.id}
                </option>
              ))}
            </select>
            <input
              value={newHookVariation}
              onChange={(event) => setNewHookVariation(event.target.value)}
              placeholder="Nova variacao de inicio..."
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
            />
            <Button type="button" className="h-8 px-3 text-xs" onClick={addHookVariation} disabled={hookVariations.length >= 10}>
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            {hookVariations.length}/10 variacoes para o mesmo corpo VSL ({pipelineBodyId}).
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {hookVariations.map((item, idx) => (
              <div key={`${item}-${idx}`} className="rounded border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
                H{String(idx + 1).padStart(2, "0")} - {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Library - Melhores Retencoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <input
            value={assetSearch}
            onChange={(event) => setAssetSearch(event.target.value)}
            placeholder="Buscar por ID ou nome do criativo"
            className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
          />
          {bestRetentionAssets.map((asset) => (
            <div key={asset.id} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-100">
                {asset.id} - {asset.name}
              </p>
              <p className="text-[#10B981]">Hold Rate: {asset.holdRate.toFixed(2)}%</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hook Library (ranking)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...editors.hookLibrary]
            .sort((a, b) => b.hookRate - a.hookRate)
            .map((item) => (
              <div key={item.creativeId} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span>
                  {item.creativeId} - {item.hook}
                </span>
                <span className={item.hookRate >= 25 ? "text-[#34A853]" : item.hookRate >= 20 ? "text-[#FF9900]" : "text-[#EA4335]"}>
                  {percent(item.hookRate)}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ROI Real por Criativo (Utmify)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roiRanking.length === 0 ? (
            <p className="text-sm text-slate-400">Aguardando sincronizacao da Utmify para ranking de ROI real.</p>
          ) : (
            roiRanking.map((item, index) => (
              <div key={`${item.creativeId}-${index}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span>
                  #{index + 1} {item.creativeId}
                </span>
                {canShowRoas ? (
                  <span className="text-[#10B981]">ROI real: {item.realRoas.toFixed(2)}x</span>
                ) : (
                  <span className="text-slate-400">ROI real: acesso protegido (ranking liberado)</span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention Heatmap (drop por segundo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {editors.retentionHeatmap.map((slot) => (
            <div key={slot.second}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{slot.second}s</span>
                <span>{percent(slot.dropOff)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-[#FF9900]" style={{ width: `${Math.min(100, slot.dropOff)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pattern Interrupt Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{editors.patternInterruptChecklist.every3s ? "✅" : "❌"} Interrupt a cada 3s</p>
          <p>{editors.patternInterruptChecklist.soundDesign ? "✅" : "❌"} Sound Design</p>
          <p>{editors.patternInterruptChecklist.vfx ? "✅" : "❌"} VFX de retenção</p>
          <Badge variant="warning">The Retention Module</Badge>
        </CardContent>
      </Card>

      <CreativeFactoryBoard tasks={data.creativeFactory.tasks} />
      <LiveAdsTable
        title="Cockpit de Producao por Criativo"
        subtitle="Visao operacional para copy + edicao (foco em retencao e velocidade)"
        rows={data.liveAdsTracking}
        hideRoasReal={!canShowRoas}
        emphasizeRetention={emphasizeRetention}
        simplified={simplified}
        showDeepDive
      />
    </section>
  );
}
