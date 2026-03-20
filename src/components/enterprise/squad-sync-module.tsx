"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";
import { computeKpis, safeDivide, toFiniteNumber } from "@/lib/metrics/kpis";

type SquadSyncModuleProps = {
  canInputDailyFeedback: boolean;
  actorName: string;
};

type KpiFieldKey = "hookRate" | "holdRate15s" | "ctrOutbound" | "icRate" | "frequency";

type KpiSnapshot = Record<KpiFieldKey, number>;

type AutoMessage = {
  id: string;
  text: string;
  createdAt: string;
};

const KPI_FIELDS: Array<{ key: KpiFieldKey; label: string; suffix: string }> = [
  { key: "hookRate", label: "Hook Rate", suffix: "%" },
  { key: "holdRate15s", label: "Hold Rate 15s", suffix: "%" },
  { key: "ctrOutbound", label: "CTR Outbound", suffix: "%" },
  { key: "icRate", label: "IC Rate", suffix: "%" },
  { key: "frequency", label: "Frequencia", suffix: "x" },
];

function inferAngle(campaign: string, adName: string) {
  const text = `${campaign} ${adName}`.toLowerCase();
  if (/prova|depoimento|social/.test(text)) {
    return "Prova Social";
  }
  if (/mecanismo|cient|metodo|framework/.test(text)) {
    return "Mecanismo Cientifico";
  }
  if (/objec|preco|quebra/.test(text)) {
    return "Quebra de Objecao";
  }
  if (/comparativo|transformacao|antes|depois|visual/.test(text)) {
    return "Comparativo Visual";
  }
  return "Narrativa Direta";
}

function formatDelta(value: number) {
  if (Math.abs(value) < 0.01) {
    return "0.00";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function SquadSyncModule({ canInputDailyFeedback, actorName }: SquadSyncModuleProps) {
  const { data, addActivity } = useWarRoom();
  const [sentimentNotes, setSentimentNotes] = useState("");
  const [messages, setMessages] = useState<AutoMessage[]>([]);
  const [lastReportAt, setLastReportAt] = useState(data.updatedAt);

  const liveRows = data.liveAdsTracking;
  const defaultCreativeId = liveRows[0]?.id ?? "";

  const [selectedCreativeId, setSelectedCreativeId] = useState(defaultCreativeId);

  const snapshotsByCreative = useMemo(() => {
    const map = new Map<string, { today: KpiSnapshot; yesterday: KpiSnapshot }>();
    for (const row of liveRows) {
      const kpi = computeKpis(row);
      const icRate = safeDivide(row.ic, row.lp) * 100;
      map.set(row.id, {
        today: {
          hookRate: kpi.hookRate,
          holdRate15s: kpi.holdRate,
          ctrOutbound: row.uniqueCtr,
          icRate,
          frequency: row.frequency,
        },
        yesterday: {
          hookRate: row.trend24h.hookRate[0] ?? kpi.hookRate,
          holdRate15s: row.trend24h.holdRate[0] ?? kpi.holdRate,
          ctrOutbound: row.uniqueCtrTrend3d[0] ?? row.uniqueCtr,
          icRate: icRate * 0.95,
          frequency: row.frequencyTrend3d[0] ?? row.frequency,
        },
      });
    }
    return map;
  }, [liveRows]);

  const baseSnapshot = snapshotsByCreative.get(selectedCreativeId) ?? {
    today: {
      hookRate: 0,
      holdRate15s: 0,
      ctrOutbound: 0,
      icRate: 0,
      frequency: 0,
    },
    yesterday: {
      hookRate: 0,
      holdRate15s: 0,
      ctrOutbound: 0,
      icRate: 0,
      frequency: 0,
    },
  };

  const [todayKpis, setTodayKpis] = useState<KpiSnapshot>(baseSnapshot.today);
  const [yesterdayKpis, setYesterdayKpis] = useState<KpiSnapshot>(baseSnapshot.yesterday);

  const editorPriority = useMemo(() => {
    return liveRows
      .map((row) => {
        const kpi = computeKpis(row);
        return {
          row,
          hookRate: kpi.hookRate,
          holdRate: kpi.holdRate,
        };
      })
      .filter((item) => item.row.roas > 2.0 && item.hookRate < 20)
      .sort((a, b) => a.hookRate - b.hookRate || b.row.roas - a.row.roas);
  }, [liveRows]);

  const anglePerformance = useMemo(() => {
    const grouped = new Map<string, { totalCpa: number; totalRoas: number; count: number }>();
    for (const row of liveRows) {
      const angle = inferAngle(row.campaign, row.adName);
      const current = grouped.get(angle) ?? { totalCpa: 0, totalRoas: 0, count: 0 };
      current.totalCpa += row.cpa;
      current.totalRoas += row.roas;
      current.count += 1;
      grouped.set(angle, current);
    }
    return [...grouped.entries()]
      .map(([angle, values]) => ({
        angle,
        avgCpa: safeDivide(values.totalCpa, values.count),
        avgRoas: safeDivide(values.totalRoas, values.count),
        count: values.count,
      }))
      .sort((a, b) => a.avgCpa - b.avgCpa);
  }, [liveRows]);

  const winnerAngle = anglePerformance[0]?.angle ?? "Sem dados";

  const hoursSinceReport = Math.max(0, (Date.now() - new Date(lastReportAt).getTime()) / (1000 * 60 * 60));
  const syncWarning = !Number.isFinite(hoursSinceReport) || hoursSinceReport > 24;

  function resetKpisForCreative(creativeId: string) {
    const snapshot = snapshotsByCreative.get(creativeId);
    if (!snapshot) {
      return;
    }
    setTodayKpis(snapshot.today);
    setYesterdayKpis(snapshot.yesterday);
  }

  function saveDailyFeedback() {
    if (!canInputDailyFeedback) {
      return;
    }

    const now = new Date();
    const urgent = editorPriority[0];
    const targetCreative = urgent?.row.id ?? selectedCreativeId;

    const text = targetCreative
      ? `Atencao Editor: O Criativo [${targetCreative}] esta com retencao excelente mas o gancho saturou. Gere 3 variacoes de Pattern Interrupt para os primeiros 5 segundos.`
      : "Atencao Editor: sem criativos elegiveis para alerta automatico neste ciclo.";

    const message: AutoMessage = {
      id: `SYNC-${now.getTime()}`,
      text,
      createdAt: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [message, ...prev].slice(0, 8));
    setLastReportAt(now.toISOString());

    addActivity(
      "Media Buyer",
      actorName,
      "salvou daily feedback",
      targetCreative || "SQUAD SYNC",
      `Hook ${todayKpis.hookRate.toFixed(2)}% | Hold ${todayKpis.holdRate15s.toFixed(2)}%`,
    );
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-[#FF9900]/30 bg-[#0b0b0b]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">SQUAD SYNC: HUB DE DEMANDA</CardTitle>
          <CardDescription className="font-mono text-xs text-slate-400">
            Terminal de sincronizacao entre Trafego, Copy e Edicao
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs">
            <p className="text-slate-300">Status de Sincronia (Mídia)</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={syncWarning ? "warning" : "success"}>
                {syncWarning ? "ALERTA LARANJA" : "SYNC OK"}
              </Badge>
              <span className={syncWarning ? "text-[#FFB347]" : "text-[#34A853]"}>
                {syncWarning
                  ? "Trafego sem relatorio diario nas ultimas 24h."
                  : `Relatorio enviado ha ${hoursSinceReport.toFixed(1)}h.`}
              </span>
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs">
            <p className="text-slate-300">Recorte de Demanda</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="warning">Fila Edicao: {editorPriority.length}</Badge>
              <Badge variant="sky">Angulo lider (menor CPA): {winnerAngle}</Badge>
              <Badge variant="default">Mensagens: {messages.length}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">1) Daily Feedback - Input do Gestor</CardTitle>
            <CardDescription className="text-xs">Ontem vs Hoje para detectar variacao de leilao instantanea</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[220px_1fr]">
              <label className="text-xs text-slate-400">Criativo de referencia</label>
              <select
                disabled={!canInputDailyFeedback}
                value={selectedCreativeId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedCreativeId(nextId);
                  resetKpisForCreative(nextId);
                }}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              >
                {liveRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.id} - {row.adName}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border border-white/10">
              <table className="min-w-full font-mono text-xs">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left">KPI</th>
                    <th className="px-2 py-2 text-right">Ontem</th>
                    <th className="px-2 py-2 text-right">Hoje</th>
                    <th className="px-2 py-2 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI_FIELDS.map((field) => {
                    const yesterday = toFiniteNumber(yesterdayKpis[field.key], 0);
                    const today = toFiniteNumber(todayKpis[field.key], 0);
                    const delta = today - yesterday;
                    const deltaClass = delta > 0 ? "text-[#34A853]" : delta < 0 ? "text-[#EA4335]" : "text-slate-300";

                    return (
                      <tr key={field.key} className="border-t border-white/10">
                        <td className="px-2 py-1.5 text-slate-200">{field.label}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            disabled={!canInputDailyFeedback}
                            value={yesterday.toFixed(2)}
                            onChange={(event) =>
                              setYesterdayKpis((prev) => ({
                                ...prev,
                                [field.key]: toFiniteNumber(event.target.value, 0),
                              }))
                            }
                            className="h-7 w-full rounded border border-white/10 bg-black/30 px-2 text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            disabled={!canInputDailyFeedback}
                            value={today.toFixed(2)}
                            onChange={(event) =>
                              setTodayKpis((prev) => ({
                                ...prev,
                                [field.key]: toFiniteNumber(event.target.value, 0),
                              }))
                            }
                            className="h-7 w-full rounded border border-white/10 bg-black/30 px-2 text-right"
                          />
                        </td>
                        <td className={`px-2 py-1.5 text-right ${deltaClass}`}>
                          {formatDelta(delta)}
                          {field.suffix}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-400">Notas de Sentimento (objeções dos comentarios)</label>
              <textarea
                disabled={!canInputDailyFeedback}
                value={sentimentNotes}
                onChange={(event) => setSentimentNotes(event.target.value)}
                placeholder="Ex.: Comentarios recorrentes sobre preco, prazo ou confianca."
                className="min-h-20 rounded border border-white/15 bg-black/30 p-2 text-xs"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {canInputDailyFeedback
                  ? "Salvar gera mensagens acionaveis automaticamente para a fila de Edicao."
                  : "Apenas o perfil de Trafego pode salvar o relatorio diario."}
              </p>
              <Button disabled={!canInputDailyFeedback} onClick={saveDailyFeedback}>
                Salvar Relatorio Diario
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">4) Actionable Messages</CardTitle>
            <CardDescription className="text-xs">Notificacoes automaticas apos salvar o daily feedback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {messages.length === 0 ? (
              <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
                Nenhuma mensagem automatica ainda. Envie o relatorio diario para alimentar a esteira de demanda.
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-100">{message.text}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Gerada as {message.createdAt}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">2) Feedback para Editores</CardTitle>
            <CardDescription className="text-xs">Lista automatica de prioridade de edicao</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {editorPriority.length === 0 ? (
              <div className="rounded-md border border-emerald-300/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                Sem casos criticos no momento para ROAS &gt; 2.0 com Hook &lt; 20%.
              </div>
            ) : (
              editorPriority.slice(0, 8).map((item) => (
                <div key={item.row.id} className="rounded-md border border-[#FF9900]/25 bg-[#FF9900]/10 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-slate-100">{item.row.id}</p>
                    <Badge variant="warning">⚡ URGENTE: NOVO GANCHO NECESSARIO</Badge>
                  </div>
                  <p className="text-xs text-slate-300">
                    ROAS {item.row.roas.toFixed(2)} | Hook {item.hookRate.toFixed(2)}% | Hold 15s {item.holdRate.toFixed(2)}%
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">3) Feedback para Copywriters</CardTitle>
            <CardDescription className="text-xs">Comparativo de performance por angulo (menor CPA lidera)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left">Angulo</th>
                    <th className="px-2 py-2 text-right">CPA Medio</th>
                    <th className="px-2 py-2 text-right">ROAS Medio</th>
                    <th className="px-2 py-2 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {anglePerformance.map((angle, index) => (
                    <tr key={angle.angle} className="border-t border-white/10">
                      <td className="px-2 py-1.5">
                        <span className={index === 0 ? "text-[#34A853]" : "text-slate-200"}>{angle.angle}</span>
                        {index === 0 && (
                          <span className="ml-2 rounded border border-emerald-300/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-100">
                            MENOR CPA
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-100">R$ {angle.avgCpa.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-100">{angle.avgRoas.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-300">{angle.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
