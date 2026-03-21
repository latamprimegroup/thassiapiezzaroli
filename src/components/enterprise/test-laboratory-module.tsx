"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UserRole } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { buildCreativeDnaName, CREATIVE_DNA_REGEX } from "@/lib/copy/creative-naming";
import { computeIntelligenceEngine } from "@/lib/metrics/intelligence-engine";
import { computeKpis, toFiniteNumber } from "@/lib/metrics/kpis";
import { evaluateCreativeTest, type TestLabVerdict } from "@/lib/metrics/test-laboratory";
import type { CreativeFormat } from "@/lib/war-room/types";

type TestLaboratoryModuleProps = {
  actorName: string;
  actorRole: UserRole;
};

type SlotType = "newAngle" | "winnerHook";
type PipelineStage = "production" | "ready" | "testing" | "decision";

type LabItem = {
  id: string;
  slot: SlotType;
  baseCreativeId: string;
  dnaName: string;
  stage: PipelineStage;
  createdAtIso: string;
  bigIdea: string;
  mechanism: string;
  format: CreativeFormat;
  hookVariation: string;
  targetCpa: number;
  spend: number;
  cpa: number;
  hookRate: number;
  ctrOutbound: number;
  verdict: TestLabVerdict | "pending";
  verdictReason: string;
  minimumSpend: number;
  maximumSpend: number;
};

const SLOT_LABEL: Record<SlotType, string> = {
  newAngle: "Slot A - Novos Angulos",
  winnerHook: "Slot B - Hooks de Vencedores",
};

const STAGE_COLUMNS: Array<{ id: PipelineStage; label: string }> = [
  { id: "production", label: "Em Producao" },
  { id: "ready", label: "Ready to Upload" },
  { id: "testing", label: "Testing Phase" },
  { id: "decision", label: "Decision Made" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatPct(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function toClock(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }
  return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function verdictToBadge(verdict: LabItem["verdict"]) {
  if (verdict === "approved") {
    return <Badge variant="success">APPROVED</Badge>;
  }
  if (verdict === "hook_failure") {
    return <Badge variant="warning">HOOK FAILURE</Badge>;
  }
  if (verdict === "killed") {
    return <Badge variant="danger">KILLED</Badge>;
  }
  if (verdict === "continue") {
    return <Badge variant="sky">CONTINUE TESTING</Badge>;
  }
  return <Badge variant="default">PENDING</Badge>;
}

function statusClass(verdict: LabItem["verdict"]) {
  if (verdict === "approved") {
    return "text-[#10B981]";
  }
  if (verdict === "hook_failure") {
    return "text-[#FF9900]";
  }
  if (verdict === "killed") {
    return "text-[#EA4335]";
  }
  return "text-slate-300";
}

export function TestLaboratoryModule({ actorName, actorRole }: TestLaboratoryModuleProps) {
  const { data, addActivity } = useWarRoom();
  const intelligence = useMemo(() => computeIntelligenceEngine(data), [data]);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const idRef = useRef(2);

  const canOperatePipeline = actorRole === "ceo" || actorRole === "mediaBuyer" || actorRole === "videoEditor";
  const winnersInScale = useMemo(() => {
    const fromDss = intelligence.validatedAssets.filter((asset) => asset.status === "scale").map((asset) => asset.assetId);
    if (fromDss.length > 0) {
      return fromDss;
    }
    return data.liveAdsTracking.filter((row) => row.roas >= 2.2).slice(0, 6).map((row) => row.id);
  }, [data.liveAdsTracking, intelligence.validatedAssets]);

  const bigIdeas = data.enterprise.copyResearch.bigIdeaVault.map((item) => item.title);
  const selectedDefaultWinner = winnersInScale[0] ?? data.liveAdsTracking[0]?.id ?? "ID1450";
  const isScalingMode = intelligence.metrics.mer >= 3;
  const targetPlan = isScalingMode
    ? { slotA: 2, slotB: 8, total: 10, label: "Escala (10-20/dia)" }
    : { slotA: 3, slotB: 2, total: 5, label: "Pre-Escala (3-5/dia)" };

  const [formState, setFormState] = useState({
    slot: "winnerHook" as SlotType,
    product: "LP9D",
    bigIdea: bigIdeas[0] ?? "BRECHA",
    mechanism: "INSULINA",
    format: "VSL" as CreativeFormat,
    hookVariation: "H01",
    uniqueId: selectedDefaultWinner.replace(/[^0-9A-Z]/gi, "") || "1450",
    baseCreativeId: selectedDefaultWinner,
    targetCpa: intelligence.validatedAssets[0]?.effectiveCpa ?? data.enterprise.trafficAttribution.squads.meta.targetCpa,
  });

  const [items, setItems] = useState<LabItem[]>(() => {
    const nowIso = new Date().toISOString();
    const baseTargetCpa = data.enterprise.trafficAttribution.squads.meta.targetCpa;
    const seedWinner = data.liveAdsTracking.find((row) => row.id === "ID1450") ?? data.liveAdsTracking[0];
    const seedName = buildCreativeDnaName({
      product: "LP9D",
      bigIdea: "BRECHA",
      mechanism: "INSULINA",
      format: "VSL",
      hookVariation: "H01",
      uniqueId: (seedWinner?.id || "1450").replace(/[^0-9A-Z]/gi, "") || "1450",
    });

    return [
      {
        id: "TL-1",
        slot: "winnerHook",
        baseCreativeId: seedWinner?.id ?? "ID1450",
        dnaName: seedName.dnaName,
        stage: "ready",
        createdAtIso: nowIso,
        bigIdea: "BRECHA",
        mechanism: "INSULINA",
        format: "VSL",
        hookVariation: "H01",
        targetCpa: baseTargetCpa,
        spend: 0,
        cpa: 0,
        hookRate: 0,
        ctrOutbound: 0,
        verdict: "pending",
        verdictReason: "Aguardando upload e inicio de teste no Meta.",
        minimumSpend: baseTargetCpa,
        maximumSpend: baseTargetCpa * 2,
      },
    ];
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), WAR_ROOM_OPS_CONSTANTS.performance.dashboardRefreshMs);
    return () => window.clearInterval(timer);
  }, []);

  const liveById = useMemo(() => {
    return new Map(data.liveAdsTracking.map((row) => [row.id, row]));
  }, [data.liveAdsTracking]);

  const testsLast24h = useMemo(() => {
    const dayAgo = clockMs - 24 * 60 * 60 * 1000;
    return items.filter((item) => new Date(item.createdAtIso).getTime() >= dayAgo);
  }, [clockMs, items]);

  const producedSlotA = testsLast24h.filter((item) => item.slot === "newAngle").length;
  const producedSlotB = testsLast24h.filter((item) => item.slot === "winnerHook").length;
  const readyQueue = items.filter((item) => item.stage === "ready");
  const testingQueue = items.filter((item) => item.stage === "testing");
  const decisionQueue = items.filter((item) => item.stage === "decision");
  const fatigueRisk = readyQueue.length < WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.minReadyToUploadQueue;

  const dnaPreview = useMemo(() => {
    return buildCreativeDnaName({
      product: formState.product,
      bigIdea: formState.bigIdea,
      mechanism: formState.mechanism,
      format: formState.format,
      hookVariation: formState.hookVariation,
      uniqueId: formState.uniqueId,
    });
  }, [formState]);

  const scatterData = useMemo(() => {
    return testsLast24h
      .filter((item) => item.cpa > 0 || item.hookRate > 0)
      .map((item) => ({
        id: item.id,
        cpa: item.cpa,
        hookRate: item.hookRate,
        verdict: item.verdict,
      }));
  }, [testsLast24h]);

  function moveItem(itemId: string, nextStage: PipelineStage) {
    if (!canOperatePipeline) {
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              stage: nextStage,
            }
          : item,
      ),
    );
  }

  function createItem() {
    if (!canOperatePipeline) {
      return;
    }
    if (!dnaPreview.valid || !CREATIVE_DNA_REGEX.test(dnaPreview.dnaName)) {
      return;
    }
    if (formState.slot === "winnerHook" && !formState.baseCreativeId.trim()) {
      return;
    }

    const nowIso = new Date().toISOString();
    const nextId = `TL-${idRef.current++}`;
    const referenceCreative = formState.slot === "winnerHook" ? formState.baseCreativeId : `BI-${formState.bigIdea}`;
    setItems((prev) => [
      {
        id: nextId,
        slot: formState.slot,
        baseCreativeId: referenceCreative,
        dnaName: dnaPreview.dnaName,
        stage: "production",
        createdAtIso: nowIso,
        bigIdea: formState.bigIdea,
        mechanism: formState.mechanism,
        format: formState.format,
        hookVariation: dnaPreview.hookVariation,
        targetCpa: Math.max(1, toFiniteNumber(formState.targetCpa, 100)),
        spend: 0,
        cpa: 0,
        hookRate: 0,
        ctrOutbound: 0,
        verdict: "pending",
        verdictReason: "Aguardando producao.",
        minimumSpend: Math.max(1, toFiniteNumber(formState.targetCpa, 100)),
        maximumSpend: Math.max(1, toFiniteNumber(formState.targetCpa, 100)) * 2,
      },
      ...prev,
    ]);

    addActivity("Test Lab", actorName, "gerou criativo para teste", dnaPreview.dnaName, SLOT_LABEL[formState.slot]);
    setFormState((prev) => ({
      ...prev,
      hookVariation: `H${String(Number(prev.hookVariation.replace(/[^0-9]/g, "") || "1") + 1).padStart(2, "0")}`,
    }));
  }

  function updateTestingField(itemId: string, field: "spend" | "cpa" | "hookRate" | "ctrOutbound", value: string) {
    const numeric = Math.max(0, toFiniteNumber(value, 0));
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: numeric } : item)));
  }

  function syncFromUtmify(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }
    const liveRow = liveById.get(item.baseCreativeId);
    if (!liveRow) {
      return;
    }
    const kpis = computeKpis(liveRow);
    const estimatedSpend = liveRow.cpa * Math.max(1, liveRow.ic);
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              stage: "testing",
              spend: Math.max(entry.spend, estimatedSpend),
              cpa: liveRow.cpa,
              hookRate: kpis.hookRate,
              ctrOutbound: liveRow.uniqueCtr,
            }
          : entry,
      ),
    );
    addActivity("Test Lab", actorName, "sincronizou dados utmify", item.baseCreativeId, `CPA ${liveRow.cpa.toFixed(2)}`);
  }

  async function evaluateItem(itemId: string) {
    const current = items.find((item) => item.id === itemId);
    if (!current) {
      return;
    }
    const payload = {
      spend: current.spend,
      cpa: current.cpa,
      targetCpa: current.targetCpa,
      hookRate: current.hookRate,
      ctrOutbound: current.ctrOutbound,
      minSpendMultiplier: WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.minSpendMultiplier,
      maxSpendMultiplier: WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.maxSpendMultiplier,
    };

    let evaluation = evaluateCreativeTest(payload);
    const response = await fetch("/api/test-laboratory/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (response?.ok) {
      const body = (await response.json().catch(() => null)) as
        | {
            result?: {
              verdict: TestLabVerdict;
              reason: string;
              minimumSpend: number;
              maximumSpend: number;
              hasMinimumSpend: boolean;
            };
          }
        | null;
      if (body?.result) {
        evaluation = body.result;
      }
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              stage: "decision",
              verdict: evaluation.verdict,
              verdictReason: evaluation.reason,
              minimumSpend: evaluation.minimumSpend,
              maximumSpend: evaluation.maximumSpend,
            }
          : item,
      ),
    );

    addActivity("Test Lab", actorName, "avaliou teste", current.dnaName, `${evaluation.verdict}: ${evaluation.reason}`);
  }

  async function notifyFatigueRisk() {
    const message =
      `RISCO DE FADIGA: fila Ready to Upload vazia. Sem novos testes, tendencia de queda de ROAS em ate ${WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.fatigueRiskHours}h.`;
    await fetch("/api/notify-squad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => undefined);
    addActivity("Test Lab", actorName, "notificou risco de fadiga", "Ready to Upload", "fila vazia");
  }

  function exportReadyCsv() {
    if (readyQueue.length === 0) {
      return;
    }
    const rows = [
      [
        "dna_name",
        "slot",
        "base_creative_id",
        "big_idea",
        "mechanism",
        "format",
        "hook_variation",
        "target_cpa",
      ].join(","),
      ...readyQueue.map((item) =>
        [
          item.dnaName,
          item.slot,
          item.baseCreativeId,
          item.bigIdea,
          item.mechanism,
          item.format,
          item.hookVariation,
          item.targetCpa.toFixed(2),
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `war-room-test-lab-ready-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addActivity("Test Lab", actorName, "exportou csv para Meta", "Ready to Upload", `${readyQueue.length} criativos`);
  }

  function renderScatter() {
    if (scatterData.length === 0) {
      return (
        <div className="rounded-md border border-white/10 bg-black/30 p-4 text-xs text-slate-400">
          Sem pontos suficientes nas ultimas 24h para gerar scatter plot.
        </div>
      );
    }
    const width = 360;
    const height = 180;
    const pad = 24;
    const minCpa = Math.min(...scatterData.map((point) => point.cpa));
    const maxCpa = Math.max(...scatterData.map((point) => point.cpa));
    const minHook = Math.min(...scatterData.map((point) => point.hookRate));
    const maxHook = Math.max(...scatterData.map((point) => point.hookRate));
    const cpaRange = maxCpa - minCpa || 1;
    const hookRange = maxHook - minHook || 1;

    return (
      <div className="rounded-md border border-white/10 bg-black/30 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#475569" strokeWidth="1" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#475569" strokeWidth="1" />
          {scatterData.map((point) => {
            const x = pad + ((point.cpa - minCpa) / cpaRange) * (width - pad * 2);
            const y = height - pad - ((point.hookRate - minHook) / hookRange) * (height - pad * 2);
            const fill =
              point.verdict === "approved"
                ? "#10B981"
                : point.verdict === "killed"
                  ? "#EA4335"
                  : point.verdict === "hook_failure"
                    ? "#FF9900"
                    : "#38BDF8";
            return <circle key={point.id} cx={x} cy={y} r="4.2" fill={fill} opacity="0.95" />;
          })}
          <text x={width / 2} y={height - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">
            CPA
          </text>
          <text x={10} y={height / 2} textAnchor="middle" className="fill-slate-400 text-[10px]" transform={`rotate(-90 10 ${height / 2})`}>
            Hook Rate 3s
          </text>
        </svg>
      </div>
    );
  }

  function renderItemCard(item: LabItem) {
    return (
      <div
        key={item.id}
        draggable={canOperatePipeline}
        onDragStart={() => setDragItemId(item.id)}
        className="rounded-md border border-white/15 bg-[#151518] p-2 text-xs"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] text-slate-100">{item.dnaName}</p>
          {verdictToBadge(item.verdict)}
        </div>
        <p className="text-[11px] text-slate-400">
          {SLOT_LABEL[item.slot]} | Ref: {item.baseCreativeId}
        </p>
        <p className="text-[11px] text-slate-500">Criado {toClock(item.createdAtIso)}</p>
        <p className="mt-1 text-[11px] text-slate-300">
          Alvo CPA {formatCurrency(item.targetCpa)} | Min {formatCurrency(item.minimumSpend)}
        </p>

        {item.stage === "production" && (
          <div className="mt-2">
            <Button type="button" className="h-7 w-full text-[11px]" disabled={!canOperatePipeline} onClick={() => moveItem(item.id, "ready")}>
              Mover para Ready to Upload
            </Button>
          </div>
        )}

        {item.stage === "ready" && (
          <div className="mt-2 flex gap-1">
            <Button type="button" className="h-7 flex-1 text-[11px]" disabled={!canOperatePipeline} onClick={() => moveItem(item.id, "testing")}>
              Iniciar Testing
            </Button>
            <Button type="button" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => syncFromUtmify(item.id)}>
              Sync Utmify
            </Button>
          </div>
        )}

        {item.stage === "testing" && (
          <div className="mt-2 space-y-1">
            <div className="grid grid-cols-2 gap-1">
              <input
                value={item.spend.toFixed(2)}
                onChange={(event) => updateTestingField(item.id, "spend", event.target.value)}
                className="h-7 rounded border border-white/15 bg-black/40 px-2 text-[11px]"
                placeholder="Spend"
              />
              <input
                value={item.cpa.toFixed(2)}
                onChange={(event) => updateTestingField(item.id, "cpa", event.target.value)}
                className="h-7 rounded border border-white/15 bg-black/40 px-2 text-[11px]"
                placeholder="CPA"
              />
              <input
                value={item.hookRate.toFixed(2)}
                onChange={(event) => updateTestingField(item.id, "hookRate", event.target.value)}
                className="h-7 rounded border border-white/15 bg-black/40 px-2 text-[11px]"
                placeholder="Hook 3s %"
              />
              <input
                value={item.ctrOutbound.toFixed(2)}
                onChange={(event) => updateTestingField(item.id, "ctrOutbound", event.target.value)}
                className="h-7 rounded border border-white/15 bg-black/40 px-2 text-[11px]"
                placeholder="CTR Outbound %"
              />
            </div>
            <Button type="button" className="h-7 w-full text-[11px]" disabled={!canOperatePipeline} onClick={() => void evaluateItem(item.id)}>
              Avaliar teste (backend)
            </Button>
          </div>
        )}

        {item.stage === "decision" && (
          <div className={`mt-2 rounded border border-white/10 bg-black/40 p-2 text-[11px] ${statusClass(item.verdict)}`}>
            {item.verdictReason}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-[#FF9900]/30 bg-[#0b0b0b]">
        <CardHeader>
          <CardTitle className="text-base">TEST LABORATORY & SCALING PIPELINE</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Engenharia de amostragem para testes diarios com regra de gasto minimo (1x-2x CPA alvo).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-300">Modo operacional</p>
            <p className="mt-1 text-[#FFB347]">{targetPlan.label}</p>
            <p className="text-slate-400">MER atual: {intelligence.metrics.mer.toFixed(2)}x</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-300">Slot A (Novos angulos)</p>
            <p className="mt-1 text-slate-100">
              {producedSlotA}/{targetPlan.slotA}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-300">Slot B (Hooks vencedores)</p>
            <p className="mt-1 text-slate-100">
              {producedSlotB}/{targetPlan.slotB}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-300">Testes hoje</p>
            <p className="mt-1 text-slate-100">
              {testsLast24h.length}/{targetPlan.total}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">Fila de Producao Diaria (Daily Input)</CardTitle>
            <CardDescription className="text-xs">
              Slot A: Big Ideas novas | Slot B: variacoes de hooks para criativos em escala.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={formState.slot}
                onChange={(event) => setFormState((prev) => ({ ...prev, slot: event.target.value as SlotType }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              >
                <option value="newAngle">Slot A - Novos Angulos</option>
                <option value="winnerHook">Slot B - Hooks de Vencedores</option>
              </select>
              <select
                value={formState.baseCreativeId}
                onChange={(event) => {
                  const nextBase = event.target.value;
                  setFormState((prev) => ({
                    ...prev,
                    baseCreativeId: nextBase,
                    uniqueId: nextBase.replace(/[^0-9A-Z]/gi, "") || prev.uniqueId,
                  }));
                }}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              >
                {winnersInScale.map((winnerId) => (
                  <option key={winnerId} value={winnerId}>
                    Winner {winnerId}
                  </option>
                ))}
              </select>
              <select
                value={formState.bigIdea}
                onChange={(event) => setFormState((prev) => ({ ...prev, bigIdea: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              >
                {bigIdeas.map((bigIdea) => (
                  <option key={bigIdea} value={bigIdea}>
                    {bigIdea}
                  </option>
                ))}
              </select>
              <input
                value={formState.mechanism}
                onChange={(event) => setFormState((prev) => ({ ...prev, mechanism: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="Mecanismo"
              />
              <select
                value={formState.format}
                onChange={(event) => setFormState((prev) => ({ ...prev, format: event.target.value as CreativeFormat }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              >
                <option value="VSL">VSL</option>
                <option value="UGC">UGC</option>
                <option value="ADVERT">ADVERT</option>
                <option value="REELS">REELS</option>
              </select>
              <input
                value={formState.hookVariation}
                onChange={(event) => setFormState((prev) => ({ ...prev, hookVariation: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="H01"
              />
              <input
                value={formState.uniqueId}
                onChange={(event) => setFormState((prev) => ({ ...prev, uniqueId: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="ID unico"
              />
              <input
                type="number"
                step="0.01"
                value={formState.targetCpa.toFixed(2)}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    targetCpa: Math.max(1, toFiniteNumber(event.target.value, prev.targetCpa)),
                  }))
                }
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="CPA alvo"
              />
            </div>

            <div className="rounded border border-white/15 bg-black/40 p-2">
              <p className="text-[11px] text-slate-400">Preview nomenclatura universal</p>
              <p className="font-mono text-xs text-slate-100">{dnaPreview.dnaName}</p>
              <p className={`text-[11px] ${dnaPreview.valid ? "text-[#10B981]" : "text-[#EA4335]"}`}>
                {dnaPreview.valid ? "Regex valida para Meta/Utmify." : "Nome invalido para padrao universal."}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" disabled={!dnaPreview.valid || !canOperatePipeline} onClick={createItem}>
                Adicionar na fila
              </Button>
              <Button type="button" variant="outline" onClick={exportReadyCsv}>
                Exportar para Meta Ads (CSV)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">Capacidade e Burn Rate</CardTitle>
            <CardDescription className="text-xs">
              Se Ready to Upload ficar vazio, risco de fadiga em ate {WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.fatigueRiskHours}h.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded border border-white/10 bg-black/30 p-3">
              <p>Fila Ready to Upload: {readyQueue.length}</p>
              <p>Testing ativo: {testingQueue.length}</p>
              <p>Decisoes feitas: {decisionQueue.length}</p>
            </div>

            {fatigueRisk ? (
              <div className="rounded border border-[#FF9900]/40 bg-[#FF9900]/10 p-3">
                <p className="font-medium text-[#FFD39A]">RISCO DE FADIGA</p>
                <p className="text-xs text-slate-300">
                  Sem criativos no Ready to Upload. O fluxo de escala pode perder tracao.
                </p>
                <Button type="button" className="mt-2 h-7 text-[11px]" onClick={() => void notifyFatigueRisk()}>
                  Notificar CEO + Head Copy
                </Button>
              </div>
            ) : (
              <div className="rounded border border-emerald-300/30 bg-emerald-500/10 p-3 text-emerald-100">
                Capacidade saudavel: fila com criativos prontos para upload.
              </div>
            )}

            <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
              <p className="mb-1 text-slate-300">Regras de validacao automatica (backend)</p>
              <p className="text-slate-400">
                APPROVED: CPA abaixo do alvo + Hook Rate 3s acima de{" "}
                {WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.approvedHookRatePct}%.
              </p>
              <p className="text-slate-400">
                HOOK FAILURE: CTR alto, mas Hook Rate abaixo de{" "}
                {WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.hookFailureRatePct}%.
              </p>
              <p className="text-slate-400">
                KILLED: CPA acima de {WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.maxSpendMultiplier}x alvo apos gasto minimo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#080808]">
        <CardHeader>
          <CardTitle className="text-base">Kanban de Teste</CardTitle>
          <CardDescription className="text-xs">
            Pipeline: Em Producao - Ready to Upload - Testing Phase - Decision Made.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 xl:grid-cols-4">
            {STAGE_COLUMNS.map((column) => {
              const columnItems = items
                .filter((item) => item.stage === column.id)
                .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
              return (
                <div
                  key={column.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!dragItemId) {
                      return;
                    }
                    moveItem(dragItemId, column.id);
                    setDragItemId(null);
                  }}
                  className="rounded-lg border border-white/10 bg-black/30 p-2"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-slate-300">{column.label}</p>
                    <Badge variant="default">{columnItems.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {columnItems.length === 0 && (
                      <p className="rounded border border-dashed border-white/15 p-2 text-[11px] text-slate-500">
                        Sem criativos nesta coluna
                      </p>
                    )}
                    {columnItems.map((item) => renderItemCard(item))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#080808]">
        <CardHeader>
          <CardTitle className="text-base">Scatter Plot (24h): CPA vs Hook Rate</CardTitle>
          <CardDescription className="text-xs">
            Identifica rapidamente padroes de sucesso em testes recentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderScatter()}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge variant="success">Verde: Approved</Badge>
            <Badge variant="warning">Laranja: Hook Failure</Badge>
            <Badge variant="danger">Vermelho: Killed</Badge>
            <Badge variant="sky">Azul: Em teste / Continue</Badge>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-slate-400">
            Bench atual: Hook medio {formatPct(intelligence.metrics.hookRate)} | Hold medio{" "}
            {formatPct(intelligence.metrics.holdRate15s)}.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
