"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";
import { buildCreativeDnaName, CREATIVE_DNA_REGEX, sanitizeNamingToken } from "@/lib/copy/creative-naming";
import {
  computeBigIdeaHealthScore,
  computeSaturationStatus,
  estimateVslLeadMinutes,
  type BigIdeaEmotion,
  type LeadType,
} from "@/lib/copy/big-idea-vault";
import { suggestHookVariationsFromHistory } from "@/lib/copy/hook-suggestion-engine";
import { safeDivide } from "@/lib/metrics/kpis";
import { computeMarketSentimentTracker } from "@/lib/metrics/corporate-intelligence";
import type { WarRoomData } from "@/lib/war-room/types";

function shelfLifeColor(saturation: number) {
  if (saturation >= 70) return "text-[#EA4335]";
  if (saturation >= 45) return "text-[#FF9900]";
  return "text-[#34A853]";
}

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

type BigIdeaVaultRecord = {
  id: string;
  title: string;
  hook: string;
  leadType: LeadType;
  primaryEmotion: BigIdeaEmotion;
  uniqueMechanismProblem: string;
  uniqueMechanismSolution: string;
  nomenclature: string;
  intellectualNovelty: string;
  proofSocialUrl: string;
  proofScientificUrl: string;
  proofHistoricalUrl: string;
  swipeReferenceUrl: string;
  whatToSteal: string;
  whatToBeat: string;
  linkedCreativeId: string;
  runningDays: number;
  cpaStart: number;
  cpaCurrent: number;
  roasCurrent: number;
  approvedByHead: boolean;
  archived: boolean;
  saturationPct: number;
  uniqueMechanismAsset: string;
  marketSophisticationLevel: 1 | 2 | 3 | 4 | 5;
  assetValue: number;
};

type SwipeRecord = {
  id: string;
  market: "BR" | "US";
  url: string;
  mechanism: string;
  whyItWorks: string;
  howWeDifferentiate: string;
};

function sanitizeForId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function deriveBigIdeaCode(title: string) {
  const token = sanitizeNamingToken(title).split("_")[0] ?? "IDEIA";
  return token || "IDEIA";
}

function nextUniqueId(registry: WarRoomData["enterprise"]["copyResearch"]["namingRegistry"]) {
  const maxId = registry.reduce((max, item) => {
    const digits = Number(item.uniqueId.replace(/[^0-9]/g, ""));
    return Number.isFinite(digits) ? Math.max(max, digits) : max;
  }, 1000);
  return `ID${String(maxId + 1).padStart(4, "0")}`;
}

function buildInitialBigIdeas(data: WarRoomData): BigIdeaVaultRecord[] {
  return data.enterprise.copyResearch.bigIdeaVault.map((idea, index) => {
    const linked = data.liveAdsTracking[index % data.liveAdsTracking.length];
    return {
      id: idea.id,
      title: idea.title,
      hook: `Como ${idea.title.toLowerCase()} pode virar lucro previsivel sem depender de promessas genericas.`,
      leadType: "segredo",
      primaryEmotion: "esperanca",
      uniqueMechanismProblem: data.enterprise.copyResearch.uniqueMechanismProblem,
      uniqueMechanismSolution: data.enterprise.copyResearch.uniqueMechanismSolution,
      nomenclature: "Protocolo de Escala Assimetrica",
      intellectualNovelty:
        "A novidade intelectual e tratar criativos como ativos de shelf-life com gatilho de saturacao e reposicao sistemica, em vez de pecas isoladas.",
      proofSocialUrl: "https://example.com/prova-social",
      proofScientificUrl: "https://example.com/prova-cientifica",
      proofHistoricalUrl: "https://example.com/prova-historica",
      swipeReferenceUrl: "https://example.com/swipe-vsl",
      whatToSteal: "Estrutura de lead com contraste forte nos primeiros 45 segundos.",
      whatToBeat: "Adicionar mecanismo mais tangivel e prova operacional em tempo real.",
      linkedCreativeId: linked?.id ?? "N/A",
      runningDays: 5 + index * 4,
      cpaStart: Math.max(80, (linked?.cpa ?? 120) * 0.82),
      cpaCurrent: linked?.cpa ?? 120,
      roasCurrent: linked?.roas ?? 1.8,
      approvedByHead: false,
      archived: false,
      saturationPct: idea.saturation,
      uniqueMechanismAsset: idea.uniqueMechanism ?? "Mecanismo ainda nao consolidado no IP Asset Management.",
      marketSophisticationLevel: idea.marketSophisticationLevel ?? 3,
      assetValue: idea.assetValue ?? 0,
    };
  });
}

function statusLabel(status: "fresh" | "fatiguing" | "saturated") {
  if (status === "fresh") return "Fresh";
  if (status === "fatiguing") return "Fatiguing";
  return "Saturated";
}

type CopyResearchModuleProps = {
  canUseUtmLinkBuilder: boolean;
  canViewRetentionByVsl: boolean;
  canApproveScripts: boolean;
  actorName: string;
};

export function CopyResearchModule({
  canUseUtmLinkBuilder,
  canViewRetentionByVsl,
  canApproveScripts,
  actorName,
}: CopyResearchModuleProps) {
  const { data, addActivity, registerCreativeNaming } = useWarRoom();
  const copyModule = data.enterprise.copyResearch;
  const [script, setScript] = useState(copyModule.scriptEditor);
  const [ruleOfOne, setRuleOfOne] = useState({
    idea: "",
    emotion: "",
    proclamation: "",
    guruApproved: false,
    guruName: "",
  });
  const [ideas, setIdeas] = useState<BigIdeaVaultRecord[]>(() => buildInitialBigIdeas(data));
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(() => buildInitialBigIdeas(data)[0]?.id ?? "");
  const [compareAId, setCompareAId] = useState<string>(() => buildInitialBigIdeas(data)[0]?.id ?? "");
  const [compareBId, setCompareBId] = useState<string>(() => buildInitialBigIdeas(data)[1]?.id ?? buildInitialBigIdeas(data)[0]?.id ?? "");
  const [swipes, setSwipes] = useState<SwipeRecord[]>([
    {
      id: "SWIPE-001",
      market: "US",
      url: "https://example.com/swipe-usa",
      mechanism: "Nomeia o mecanismo com linguagem de descoberta proprietaria.",
      whyItWorks: "Combina medo + esperanca com prova factual na abertura.",
      howWeDifferentiate: "Inserir benchmark de lucro real e recorte por squad para aumentar credibilidade.",
    },
  ]);
  const [newSwipe, setNewSwipe] = useState({
    market: "BR" as "BR" | "US",
    url: "",
    mechanism: "",
    whyItWorks: "",
    howWeDifferentiate: "",
  });
  const [selectedCloneCreativeId, setSelectedCloneCreativeId] = useState("");
  const [utmDraft, setUtmDraft] = useState({
    baseUrl: "https://oferta.exemplo/vsl",
    source: "meta",
    hookVariation: "H01",
    extraVariation: "",
  });
  const [namingDraft, setNamingDraft] = useState(() => ({
    product: "LP9D",
    bigIdea: deriveBigIdeaCode(buildInitialBigIdeas(data)[0]?.title ?? "IDEIA"),
    mechanism: "INSULINA",
    format: "VSL" as const,
    hookVariation: "01",
    uniqueId: nextUniqueId(data.enterprise.copyResearch.namingRegistry),
    linkedCreativeId: data.liveAdsTracking[0]?.id ?? "N/A",
  }));
  const [assetDraft, setAssetDraft] = useState({
    title: "",
    offerId: "OFF-DEFAULT",
  });
  const [assetWorkflow, setAssetWorkflow] = useState<
    Array<{
      id: string;
      title: string;
      offerId: string;
      status: "aguardando_edicao" | "pronto_para_trafego";
      createdByName: string;
      updatedAt: string;
    }>
  >([]);
  const [deepInsights, setDeepInsights] = useState<{
    creativeHeatmap: Array<{
      utmContent: string;
      sessions: number;
      avgWatchMinutes: number;
      coldPointMinute: number;
      highestDropPct: number;
    }>;
    ipTriggerRanking: Array<{
      triggerName: string;
      samples: number;
      avgRoas: number;
      avgCpa: number;
      avgLtv90: number;
      score: number;
    }>;
  } | null>(null);
  const [settlementFeedback, setSettlementFeedback] = useState<
    Array<{
      id: string;
      date: string;
      managerName: string;
      niche: string;
      winningCreativeId: string;
      audienceInsight: string;
      netProfit: number;
    }>
  >([]);

  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) ?? ideas[0];

  function patchSelectedIdea(updater: (idea: BigIdeaVaultRecord) => BigIdeaVaultRecord) {
    if (!selectedIdea) {
      return;
    }
    setIdeas((prev) => prev.map((idea) => (idea.id === selectedIdea.id ? updater(idea) : idea)));
  }

  const ideasWithSaturation = useMemo(
    () =>
      ideas.map((idea) => {
        const status = computeSaturationStatus({
          cpaStart: idea.cpaStart,
          cpaCurrent: idea.cpaCurrent,
          roasCurrent: idea.roasCurrent,
          runningDays: idea.runningDays,
        });
        return {
          ...idea,
          shelfStatus: status,
          cpaLiftPct: safeDivide(idea.cpaCurrent - idea.cpaStart, idea.cpaStart || 1) * 100,
        };
      }),
    [ideas],
  );

  const score = selectedIdea
    ? computeBigIdeaHealthScore({
        hook: selectedIdea.hook,
        uniqueMechanism: selectedIdea.uniqueMechanismSolution,
        intellectualNovelty: selectedIdea.intellectualNovelty,
        nomenclature: selectedIdea.nomenclature,
        proofSocialUrl: selectedIdea.proofSocialUrl,
        proofScientificUrl: selectedIdea.proofScientificUrl,
        proofHistoricalUrl: selectedIdea.proofHistoricalUrl,
        swipeReferenceUrl: selectedIdea.swipeReferenceUrl,
        whatToSteal: selectedIdea.whatToSteal,
        whatToBeat: selectedIdea.whatToBeat,
      })
    : 0;
  const hasMechanismDepth = (selectedIdea?.uniqueMechanismSolution.trim().length ?? 0) >= 300;
  const hasCounterIntuitive = (selectedIdea?.intellectualNovelty.trim().length ?? 0) >= 120;
  const hasIrrefutableProof =
    (selectedIdea?.proofSocialUrl.trim().length ?? 0) > 0 &&
    (selectedIdea?.proofScientificUrl.trim().length ?? 0) > 0 &&
    (selectedIdea?.proofHistoricalUrl.trim().length ?? 0) > 0;
  const canDispatch = score >= 70 && hasMechanismDepth;

  const words = script.trim().length > 0 ? script.trim().split(/\s+/).length : 0;
  const estimatedMinutes = estimateVslLeadMinutes(words);

  async function createSquadTasksForApprovedIdea(idea: BigIdeaVaultRecord) {
    const marker = `[BIG IDEA ${idea.id}]`;
    const response = await fetch("/api/command-center/tasks", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nao foi possivel carregar tarefas do Command Center.");
    }
    const payload = (await response.json()) as { tasks?: DemandTask[] };
    const currentTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const hasWorkflow = currentTasks.some((task) => task.title.includes(marker));
    if (hasWorkflow) {
      return;
    }

    const nowIso = new Date().toISOString();
    const dueIso = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const base = `BIG-${sanitizeForId(idea.id)}-${Date.now()}`;
    const impact = idea.roasCurrent < 1.5 ? "critical" : "high";
    const editTask: DemandTask = {
      id: `${base}-EDT`,
      department: "editorsCreative",
      title: `${marker} Briefing de Producao`,
      description: `Produzir assets para "${idea.title}" | Gancho: ${idea.hook} | Emocao: ${idea.primaryEmotion}.`,
      squadHead: "Head Edicao - Nati",
      assignee: "Editor A",
      status: "backlog",
      impact,
      createdAt: nowIso,
      lastMovedAt: nowIso,
      dueAt: dueIso,
      dependencyIds: [],
      doneApproval: {
        required: true,
        approved: false,
        approvedBy: "",
        approvedRole: "",
        approvedAt: "",
        note: "",
      },
      decisionLog: [
        {
          at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          author: "Head Copy",
          note: `Big Idea aprovada no Vault: ${idea.id}.`,
        },
      ],
    };
    const mediaTask: DemandTask = {
      id: `${base}-MID`,
      department: "trafficMedia",
      title: `${marker} Plano de Teste de Criativos`,
      description: `Criar plano de testes para ${idea.linkedCreativeId} com novo mecanismo (${idea.nomenclature}).`,
      squadHead: "Head Midia - Caio",
      assignee: "Media Buyer A",
      status: "backlog",
      impact,
      createdAt: nowIso,
      lastMovedAt: nowIso,
      dueAt: dueIso,
      dependencyIds: [editTask.id],
      doneApproval: {
        required: false,
        approved: false,
        approvedBy: "",
        approvedRole: "",
        approvedAt: "",
        note: "",
      },
      decisionLog: [
        {
          at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          author: "Head Copy",
          note: `Plano de midia gerado automaticamente para Big Idea ${idea.id}.`,
        },
      ],
    };

    const save = await fetch("/api/command-center/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: [editTask, mediaTask, ...currentTasks] }),
    });
    if (!save.ok) {
      throw new Error("Falha ao persistir tarefas espelho do Vault.");
    }
  }

  async function approveIdeaAndDispatch() {
    if (!selectedIdea || !canDispatch || !canApproveScripts) {
      return;
    }
    patchSelectedIdea((idea) => ({ ...idea, approvedByHead: true }));
    addActivity("Head Copy", "Head Copy", "aprovou Big Idea", selectedIdea.id, `score ${score}/100`);
    try {
      await createSquadTasksForApprovedIdea(selectedIdea);
      addActivity("Sistema", "War Room OS", "gerou tarefas por aprovacao de Big Idea", selectedIdea.id, "edicao + midia");
    } catch (error) {
      addActivity(
        "Sistema",
        "War Room OS",
        "falhou ao gerar tarefas da Big Idea",
        selectedIdea.id,
        error instanceof Error ? error.message : "erro desconhecido",
      );
    }
  }

  function exportBriefingPdf() {
    if (!selectedIdea) {
      return;
    }
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      return;
    }
    w.document.write(`
      <html>
        <head><title>Briefing ${selectedIdea.id}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Briefing de Edicao - ${selectedIdea.title}</h1>
          <p><strong>The Hook:</strong> ${selectedIdea.hook}</p>
          <p><strong>Mecanismo Unico:</strong> ${selectedIdea.uniqueMechanismSolution}</p>
          <p><strong>Novidade Intelectual:</strong> ${selectedIdea.intellectualNovelty}</p>
          <p><strong>Emocao-Alvo:</strong> ${selectedIdea.primaryEmotion}</p>
          <p><strong>Provas:</strong></p>
          <ul>
            <li>${selectedIdea.proofSocialUrl}</li>
            <li>${selectedIdea.proofScientificUrl}</li>
            <li>${selectedIdea.proofHistoricalUrl}</li>
          </ul>
          <p><strong>Lead (Markdown):</strong></p>
          <pre style="white-space: pre-wrap;">${script.replaceAll("<", "&lt;")}</pre>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  function addSwipe() {
    if (!newSwipe.url.trim() || !newSwipe.mechanism.trim()) {
      return;
    }
    const entry: SwipeRecord = {
      id: `SWIPE-${swipes.length + 1}-${newSwipe.market}`,
      market: newSwipe.market,
      url: newSwipe.url.trim(),
      mechanism: newSwipe.mechanism.trim(),
      whyItWorks: newSwipe.whyItWorks.trim(),
      howWeDifferentiate: newSwipe.howWeDifferentiate.trim(),
    };
    setSwipes((prev) => [entry, ...prev]);
    setNewSwipe({ market: "BR", url: "", mechanism: "", whyItWorks: "", howWeDifferentiate: "" });
    addActivity("Pesquisa", "Research Squad", "adicionou swipe competitivo", entry.id, entry.market);
  }

  function cloneMarketStructure() {
    const candidate = marketCloneCandidates.find((item) => item.creativeId === selectedCloneCreativeId) ?? marketCloneCandidates[0];
    if (!candidate) {
      return;
    }
    const entry: SwipeRecord = {
      id: `SWIPE-CLONE-${candidate.creativeId}-${swipes.length + 1}`,
      market: candidate.source === "native" ? "US" : "BR",
      url: `https://market-intel.local/${candidate.creativeId}`,
      mechanism: `Estrutura clonada de ${candidate.creativeId} (ROAS ${candidate.realRoas.toFixed(2)}x)`,
      whyItWorks: "Anuncio com alta tracao em janela recente para desconstrucao orientada por blocos.",
      howWeDifferentiate: "Aplicar Mecanismo Unico interno com nova proclamacao e provas proprietarias.",
    };
    setSwipes((prev) => [entry, ...prev]);
    addActivity("Pesquisa", "Research Squad", "clonou estrutura de swipe escalado", candidate.creativeId, "dynamic swipe clone");
  }

  const compareA = ideas.find((idea) => idea.id === compareAId) ?? ideas[0];
  const compareB = ideas.find((idea) => idea.id === compareBId) ?? ideas[1] ?? ideas[0];
  const winnerByCpa = compareA && compareB ? (compareA.cpaCurrent <= compareB.cpaCurrent ? compareA : compareB) : null;
  const activeBigIdeaCodes = useMemo(
    () =>
      ideasWithSaturation
        .filter((idea) => !idea.archived && idea.shelfStatus !== "saturated")
        .map((idea) => deriveBigIdeaCode(idea.title)),
    [ideasWithSaturation],
  );
  const mechanismOptions = useMemo(() => {
    const fromRegistry = data.enterprise.copyResearch.namingRegistry.map((item) => item.mechanism);
    return Array.from(new Set([...fromRegistry, "INSULINA", "JUROS", "SOL", "METABOLISMO", "PROTOCOL"]));
  }, [data.enterprise.copyResearch.namingRegistry]);
  const namingPreview = buildCreativeDnaName({
    product: namingDraft.product,
    bigIdea: namingDraft.bigIdea,
    mechanism: namingDraft.mechanism,
    format: namingDraft.format,
    hookVariation: namingDraft.hookVariation,
    uniqueId: namingDraft.uniqueId,
  });
  const canWriteScript =
    ruleOfOne.idea.trim().length > 0 &&
    ruleOfOne.emotion.trim().length > 0 &&
    ruleOfOne.proclamation.trim().length > 0 &&
    ruleOfOne.guruApproved;
  const marketCloneCandidates = data.integrations.attribution.realRoiLeaderboard
    .slice()
    .sort((a, b) => b.realRoas - a.realRoas)
    .slice(0, 8);
  const hookSuggestions = useMemo(() => suggestHookVariationsFromHistory(data.liveAdsTracking, 6), [data.liveAdsTracking]);
  const sentiment = useMemo(() => computeMarketSentimentTracker(data), [data]);
  const retentionByVsl = useMemo(
    () =>
      data.liveAdsTracking
        .map((row) => ({
          id: row.id,
          holdRate15s: safeDivide(row.views15s, Math.max(1, row.views3s)) * 100,
          hookRate: safeDivide(row.views3s, Math.max(1, row.impressions)) * 100,
          vslEfficiency: safeDivide(row.ic, Math.max(1, row.lp)) * 100,
        }))
        .sort((a, b) => b.holdRate15s - a.holdRate15s)
        .slice(0, 8),
    [data.liveAdsTracking],
  );
  const scriptApprovalQueue = useMemo(
    () =>
      ideasWithSaturation
        .filter((idea) => !idea.approvedByHead && !idea.archived)
        .map((idea) => ({
          id: idea.id,
          title: idea.title,
          score: computeBigIdeaHealthScore({
            hook: idea.hook,
            uniqueMechanism: idea.uniqueMechanismSolution,
            intellectualNovelty: idea.intellectualNovelty,
            nomenclature: idea.nomenclature,
            proofSocialUrl: idea.proofSocialUrl,
            proofScientificUrl: idea.proofScientificUrl,
            proofHistoricalUrl: idea.proofHistoricalUrl,
            swipeReferenceUrl: idea.swipeReferenceUrl,
            whatToSteal: idea.whatToSteal,
            whatToBeat: idea.whatToBeat,
          }),
        }))
        .slice(0, 6),
    [ideasWithSaturation],
  );
  const utmPreview = useMemo(() => {
    const chosenIdea = selectedIdea ?? ideasWithSaturation[0];
    const ideaCode = chosenIdea ? deriveBigIdeaCode(chosenIdea.title) : "IDEIA";
    const variationToken = sanitizeNamingToken(utmDraft.extraVariation || utmDraft.hookVariation || "H01");
    const linkedId = chosenIdea?.linkedCreativeId || "ID0000";
    const source = sanitizeNamingToken(utmDraft.source || "meta").toLowerCase();
    const baseUrl = utmDraft.baseUrl.trim();
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}utm_source=${source}&utm_campaign=${ideaCode}|${chosenIdea?.id || "BIG_IDEA"}&utm_content=${variationToken}|${linkedId}&utm_term=${sanitizeNamingToken(chosenIdea?.nomenclature || "MECANISMO")}|${linkedId}`;
  }, [ideasWithSaturation, selectedIdea, utmDraft.baseUrl, utmDraft.extraVariation, utmDraft.hookVariation, utmDraft.source]);

  const fetchAssetWorkflow = useCallback(async () => {
    const response = await fetch("/api/assets/workflow", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | {
          items?: Array<{
            id: string;
            title: string;
            offerId: string;
            status: "aguardando_edicao" | "pronto_para_trafego";
            createdByName: string;
            updatedAt: string;
          }>;
        }
      | null;
    if (!payload?.items) {
      return;
    }
    setAssetWorkflow(payload.items);
  }, []);

  const fetchDeepInsights = useCallback(async () => {
    const response = await fetch("/api/lead-intelligence/dashboard", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | {
          dashboard?: {
            creativeHeatmap?: Array<{
              utmContent: string;
              sessions: number;
              avgWatchMinutes: number;
              coldPointMinute: number;
              highestDropPct: number;
            }>;
            ipTriggerRanking?: Array<{
              triggerName: string;
              samples: number;
              avgRoas: number;
              avgCpa: number;
              avgLtv90: number;
              score: number;
            }>;
          };
        }
      | null;
    if (!payload?.dashboard) {
      return;
    }
    setDeepInsights({
      creativeHeatmap: payload.dashboard.creativeHeatmap ?? [],
      ipTriggerRanking: payload.dashboard.ipTriggerRanking ?? [],
    });
  }, []);

  const fetchDailySettlementFeedback = useCallback(async () => {
    const response = await fetch("/api/daily-settlements?mode=feedback&team=copy&limit=10", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | {
          items?: Array<{
            id: string;
            date: string;
            managerName: string;
            niche: string;
            winningCreativeId: string;
            audienceInsight: string;
            netProfit: number;
          }>;
        }
      | null;
    if (!payload?.items) {
      return;
    }
    setSettlementFeedback(payload.items);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAssetWorkflow();
      void fetchDeepInsights();
      void fetchDailySettlementFeedback();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAssetWorkflow, fetchDailySettlementFeedback, fetchDeepInsights]);

  async function copyNamingToClipboard() {
    if (!namingPreview.valid) {
      return;
    }
    try {
      await navigator.clipboard.writeText(namingPreview.dnaName);
      addActivity("Edicao", "Naming Builder", "copiou nomenclatura", namingPreview.dnaName, "meta sync");
    } catch {
      addActivity("Edicao", "Naming Builder", "falhou ao copiar nomenclatura", namingPreview.dnaName, "clipboard");
    }
  }

  function saveNamingEntry() {
    if (!namingPreview.valid) {
      return;
    }
    const entry: WarRoomData["enterprise"]["copyResearch"]["namingRegistry"][number] = {
      id: `DNA-${Date.now()}`,
      product: namingPreview.product,
      bigIdea: namingPreview.bigIdea,
      mechanism: namingPreview.mechanism,
      format: namingPreview.format,
      hookVariation: namingPreview.hookVariation,
      uniqueId: namingPreview.uniqueId,
      dnaName: namingPreview.dnaName,
      linkedCreativeId: namingDraft.linkedCreativeId,
      createdAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      active: true,
    };
    registerCreativeNaming(entry);
    setNamingDraft((prev) => ({ ...prev, uniqueId: nextUniqueId([entry, ...data.enterprise.copyResearch.namingRegistry]) }));
    addActivity("Ops", "Naming Builder", "registrou DNA universal", entry.dnaName, entry.linkedCreativeId);
  }

  async function copyUtmLink() {
    if (!canUseUtmLinkBuilder) {
      return;
    }
    try {
      await navigator.clipboard.writeText(utmPreview);
      addActivity("Copy", actorName, "copiou link UTM pre-aprovado", selectedIdea?.id ?? "N/A", utmPreview);
    } catch {
      addActivity("Copy", actorName, "falhou ao copiar link UTM", selectedIdea?.id ?? "N/A", "clipboard");
    }
  }

  function approveFromQueue(ideaId: string) {
    if (!canApproveScripts) {
      return;
    }
    setIdeas((prev) => prev.map((idea) => (idea.id === ideaId ? { ...idea, approvedByHead: true } : idea)));
    addActivity("Head Copy", actorName, "aprovou roteiro para producao", ideaId, "fila de aprovacao senior");
  }

  async function submitScriptToEditing() {
    if (!assetDraft.title.trim() || !assetDraft.offerId.trim()) {
      return;
    }
    const response = await fetch("/api/assets/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit_script",
        title: assetDraft.title,
        offerId: assetDraft.offerId,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    setAssetDraft((prev) => ({ ...prev, title: "" }));
    addActivity("Copy", actorName, "subiu roteiro", assetDraft.offerId, "status aguardando edicao");
    void fetchAssetWorkflow();
  }

  async function registerTriggerPerformanceMvp() {
    if (!selectedIdea) {
      return;
    }
    const response = await fetch("/api/lead-intelligence/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerPerformance: [
          {
            triggerId: `TR-${sanitizeForId(selectedIdea.primaryEmotion)}`,
            triggerName: `Gatilho ${selectedIdea.primaryEmotion}`,
            niche: selectedIdea.marketSophisticationLevel >= 4 ? "sofisticado" : "massificado",
            utmContent: selectedIdea.linkedCreativeId,
            hookRate: safeDivide(selectedIdea.roasCurrent * 100, Math.max(1, selectedIdea.cpaCurrent)),
            holdRate: Math.max(10, 55 - selectedIdea.saturationPct * 0.4),
            cpa: selectedIdea.cpaCurrent,
            roas: selectedIdea.roasCurrent,
            ltv90: selectedIdea.assetValue > 0 ? selectedIdea.assetValue / 12 : 0,
          },
        ],
      }),
    }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    addActivity("Copy", actorName, "registrou performance de gatilho", selectedIdea.id, selectedIdea.primaryEmotion);
    void fetchDeepInsights();
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unique Mechanism Matrix</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
            <p className="mb-1 text-xs uppercase text-slate-400">Mecanismo Unico do Problema</p>
            <p>{copyModule.uniqueMechanismProblem}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
            <p className="mb-1 text-xs uppercase text-slate-400">Mecanismo Unico da Solucao</p>
            <p>{copyModule.uniqueMechanismSolution}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Sentiment & Sophistication Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">Sofisticacao sugerida</p>
              <p className="text-slate-100">Nivel {sentiment.level}/5</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">CTR promessa direta</p>
              <p className={sentiment.directTrend < 0 ? "text-[#EA4335]" : "text-slate-100"}>{sentiment.directCtr.toFixed(2)}%</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">CTR mecanismo indireto</p>
              <p className={sentiment.indirectTrend > 0 ? "text-[#10B981]" : "text-slate-100"}>{sentiment.indirectCtr.toFixed(2)}%</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">Recomendacao</p>
              <p className={sentiment.demandMoreSophisticated ? "text-[#FF9900]" : "text-[#10B981]"}>
                {sentiment.demandMoreSophisticated ? "Migrar para indireto" : "Manter mix atual"}
              </p>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-slate-200">{sentiment.recommendation}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback do Daily Settlement (Time de Copy)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {settlementFeedback.length === 0 ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-500">
              Sem feedback recente de gestores de trafego.
            </p>
          ) : (
            settlementFeedback.map((item) => (
              <div key={item.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">
                  {item.date} | {item.managerName} | Nicho: {item.niche}
                </p>
                <p className="text-[#FFB347]">{item.audienceInsight}</p>
                <p className="text-slate-400">
                  Winner: {item.winningCreativeId} | Lucro estimado:{" "}
                  {item.netProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canUseUtmLinkBuilder && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Tool - Gerador de Links UTM pré-aprovadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={utmDraft.baseUrl}
                onChange={(event) => setUtmDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://oferta.exemplo/vsl"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
              <select
                value={utmDraft.source}
                onChange={(event) => setUtmDraft((prev) => ({ ...prev, source: event.target.value }))}
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              >
                <option value="meta">Meta</option>
                <option value="google">Google</option>
                <option value="tiktok">TikTok</option>
                <option value="kwai">Kwai</option>
              </select>
              <input
                value={utmDraft.hookVariation}
                onChange={(event) => setUtmDraft((prev) => ({ ...prev, hookVariation: event.target.value }))}
                placeholder="H01"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
              <input
                value={utmDraft.extraVariation}
                onChange={(event) => setUtmDraft((prev) => ({ ...prev, extraVariation: event.target.value }))}
                placeholder="Variacao opcional"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="rounded border border-white/15 bg-black/40 p-2 font-mono text-[11px] text-[#FFD39A]">
              {utmPreview}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="h-8 px-3 text-xs" onClick={copyUtmLink}>
                Copiar link para Tráfego
              </Button>
              <Button
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  addActivity("Copy", actorName, "gerou link UTM para gestor", selectedIdea?.id ?? "N/A", utmPreview)
                }
              >
                Registrar envio para Gestor
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status de Ativo (Copy -&gt; Edicao)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
            <input
              value={assetDraft.title}
              onChange={(event) => setAssetDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Titulo do roteiro"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
            <input
              value={assetDraft.offerId}
              onChange={(event) => setAssetDraft((prev) => ({ ...prev, offerId: event.target.value }))}
              placeholder="ID da oferta"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
            <Button type="button" className="h-8 px-3 text-xs" onClick={() => void submitScriptToEditing()}>
              Subir roteiro
            </Button>
          </div>
          <div className="space-y-1">
            {assetWorkflow
              .filter((asset) => asset.status === "aguardando_edicao")
              .slice(0, 6)
              .map((asset) => (
                <div key={asset.id} className="rounded border border-white/10 bg-white/5 p-2">
                  <p className="text-slate-100">
                    {asset.title} ({asset.offerId})
                  </p>
                  <p className="text-[#FF9900]">Status: Aguardando Edicao</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creative Performance Heatmap + IP Trigger Ranking (MVP)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-slate-300">Heatmap por utm_content</p>
            {deepInsights?.creativeHeatmap.slice(0, 6).map((row) => (
              <div key={row.utmContent} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">{row.utmContent}</p>
                <p className="text-slate-300">
                  Sessoes {row.sessions} | Watch medio {row.avgWatchMinutes.toFixed(1)} min
                </p>
                <p className={row.highestDropPct >= 45 ? "text-[#EA4335]" : row.highestDropPct >= 30 ? "text-[#FF9900]" : "text-[#10B981]"}>
                  Esfria no min {row.coldPointMinute} | Drop {row.highestDropPct.toFixed(1)}%
                </p>
              </div>
            ))}
            {(deepInsights?.creativeHeatmap.length ?? 0) === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-500">
                Sem dados de heatmap ainda. Envie eventos para /api/lead-intelligence/events.
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-slate-300">Ranking financeiro de gatilhos</p>
            {deepInsights?.ipTriggerRanking.slice(0, 6).map((row) => (
              <div key={row.triggerName} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">{row.triggerName}</p>
                <p className="text-slate-300">
                  ROAS {row.avgRoas.toFixed(2)} | CPA {row.avgCpa.toFixed(1)} | LTV90 {row.avgLtv90.toFixed(0)}
                </p>
                <p className="text-[#10B981]">Score {row.score.toFixed(1)} | amostras {row.samples}</p>
              </div>
            ))}
            {(deepInsights?.ipTriggerRanking.length ?? 0) === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-500">
                Sem ranking de gatilhos ainda. Envie triggerPerformance para /api/lead-intelligence/events.
              </p>
            ) : null}
            <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void registerTriggerPerformanceMvp()}>
              Registrar gatilho do dossie atual
            </Button>
          </div>
        </CardContent>
      </Card>

      {canViewRetentionByVsl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visão Sênior - Taxa de Retenção por VSL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {retentionByVsl.map((row) => (
              <div key={row.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">{row.id}</p>
                <p className="text-slate-300">
                  Hook {row.hookRate.toFixed(2)}% | Hold 15s {row.holdRate15s.toFixed(2)}% | IC {row.vslEfficiency.toFixed(2)}%
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canApproveScripts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visão Sênior - Aprovação de Roteiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {scriptApprovalQueue.length === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Sem roteiros pendentes.</p>
            ) : (
              scriptApprovalQueue.map((item) => (
                <div key={item.id} className="rounded border border-white/10 bg-white/5 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-slate-100">{item.title}</p>
                    <Badge variant={item.score >= 70 ? "success" : "warning"}>{item.score}/100</Badge>
                  </div>
                  <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => approveFromQueue(item.id)}>
                    Aprovar roteiro
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The Big Idea Vault (Padrao Agora Inc.)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {ideasWithSaturation.map((idea) => (
              <div key={idea.id} className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-100">{idea.title}</p>
                  <Badge
                    variant={
                      idea.shelfStatus === "fresh" ? "success" : idea.shelfStatus === "fatiguing" ? "warning" : "danger"
                    }
                  >
                    {statusLabel(idea.shelfStatus)}
                  </Badge>
                </div>
                <p className={`text-xs ${shelfLifeColor(idea.saturationPct)}`}>
                  Saturacao: {idea.saturationPct}% | Rodagem: {idea.runningDays}d | CPA +{idea.cpaLiftPct.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400">
                  ROAS {idea.roasCurrent.toFixed(2)} | ID vinculado: {idea.linkedCreativeId}
                </p>
                <p className="text-xs text-[#FFB347]">
                  IP Asset: Nivel S{idea.marketSophisticationLevel} | Valor estimado {idea.assetValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" className="h-6 px-2 text-[11px]" onClick={() => setSelectedIdeaId(idea.id)}>
                    Abrir dossie
                  </Button>
                  {idea.shelfStatus === "fatiguing" && (
                    <Button
                      type="button"
                      className="h-6 px-2 text-[11px]"
                      onClick={() =>
                        addActivity("Head Copy", "Head Copy", "notificou refatoracao de lead", idea.id, "CPA +20% em 7 dias")
                      }
                    >
                      Notificar Head
                    </Button>
                  )}
                  {idea.shelfStatus === "saturated" && !idea.archived && (
                    <Button
                      type="button"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        setIdeas((prev) => prev.map((item) => (item.id === idea.id ? { ...item, archived: true } : item)));
                        addActivity("Head Copy", "Head Copy", "arquivou Big Idea saturada", idea.id, "ROAS < 1.5");
                      }}
                    >
                      Arquivar ideia
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engine de Variacoes de Gancho (Historico de Hook Rate)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hookSuggestions.map((item) => (
            <div key={`${item.sourceCreativeId}-${item.suggestion}`} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-100">
                Base: {item.sourceCreativeId} ({item.sourceHookRate.toFixed(2)}% hook)
              </p>
              <p className="text-[#FFB347]">{item.suggestion}</p>
            </div>
          ))}
          <p className="text-[11px] text-slate-500">
            Sugestoes geradas automaticamente a partir dos criativos com maior Hook Rate historico.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Naming Builder Universal (Meta Sync)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-300">
              <span>PRODUTO</span>
              <input
                value={namingDraft.product}
                onChange={(event) => setNamingDraft((prev) => ({ ...prev, product: event.target.value }))}
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>BIG IDEA</span>
              <select
                value={namingDraft.bigIdea}
                onChange={(event) => setNamingDraft((prev) => ({ ...prev, bigIdea: event.target.value }))}
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              >
                {activeBigIdeaCodes.length === 0 ? (
                  <option value="IDEIA">IDEIA</option>
                ) : (
                  activeBigIdeaCodes.map((ideaCode) => (
                    <option key={ideaCode} value={ideaCode}>
                      {ideaCode}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>MECANISMO</span>
              <select
                value={namingDraft.mechanism}
                onChange={(event) => setNamingDraft((prev) => ({ ...prev, mechanism: event.target.value }))}
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              >
                {mechanismOptions.map((mechanism) => (
                  <option key={mechanism} value={mechanism}>
                    {mechanism}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>FORMATO</span>
              <select
                value={namingDraft.format}
                onChange={(event) =>
                  setNamingDraft((prev) => ({ ...prev, format: event.target.value as typeof namingDraft.format }))
                }
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              >
                <option value="VSL">VSL</option>
                <option value="UGC">UGC</option>
                <option value="ADVERT">ADVERT</option>
                <option value="REELS">REELS</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>VARIACAO HOOK</span>
              <input
                value={namingDraft.hookVariation}
                onChange={(event) => setNamingDraft((prev) => ({ ...prev, hookVariation: event.target.value }))}
                placeholder="01"
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>ID_UNICO</span>
              <input
                value={namingDraft.uniqueId}
                onChange={(event) => setNamingDraft((prev) => ({ ...prev, uniqueId: event.target.value }))}
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="space-y-1 text-xs text-slate-300">
            <span>Link com Criativo (ID no dashboard/ROI)</span>
            <select
              value={namingDraft.linkedCreativeId}
              onChange={(event) => setNamingDraft((prev) => ({ ...prev, linkedCreativeId: event.target.value }))}
              className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
            >
              {data.liveAdsTracking.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.id} | {row.adName}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded border border-white/15 bg-black/40 p-3 font-mono text-sm text-[#FFD39A]">
            {namingPreview.dnaName}
          </div>
          <p className={namingPreview.valid ? "text-xs text-[#10B981]" : "text-xs text-[#EA4335]"}>
            Regex: {CREATIVE_DNA_REGEX.source} | status {namingPreview.valid ? "valido" : "invalido"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-8 px-3 text-xs" onClick={copyNamingToClipboard} disabled={!namingPreview.valid}>
              Copy to Clipboard
            </Button>
            <Button type="button" className="h-8 px-3 text-xs" onClick={saveNamingEntry} disabled={!namingPreview.valid}>
              Gerar Nome
            </Button>
          </div>
          <div className="space-y-1">
            {data.enterprise.copyResearch.namingRegistry.slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                <p className="font-mono text-slate-200">{entry.dnaName}</p>
                <p className="text-slate-400">
                  {entry.linkedCreativeId} | {entry.createdAt} | {entry.active ? "active" : "archived"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedIdea && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ficha de Desconstrucao 9D - {selectedIdea.id}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-300">
                <span>Headline Provisoria (Big Idea)</span>
                <input
                  value={selectedIdea.title}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, title: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>The Hook</span>
                <input
                  value={selectedIdea.hook}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, hook: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-300">
                <span>Lead Type</span>
                <select
                  value={selectedIdea.leadType}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, leadType: event.target.value as LeadType }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                >
                  <option value="direta">Direta</option>
                  <option value="indireta">Indireta</option>
                  <option value="segredo">Segredo</option>
                  <option value="proclamacao">Proclamacao</option>
                  <option value="historia">Historia</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>Primary Emotion</span>
                <select
                  value={selectedIdea.primaryEmotion}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({ ...idea, primaryEmotion: event.target.value as BigIdeaEmotion }))
                  }
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                >
                  <option value="medo">Medo</option>
                  <option value="ganancia">Ganancia</option>
                  <option value="revolta">Revolta</option>
                  <option value="esperanca">Esperanca</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>Nomenclatura Propria</span>
                <input
                  value={selectedIdea.nomenclature}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, nomenclature: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>Nivel de Sofisticacao de Mercado (1-5)</span>
                <select
                  value={selectedIdea.marketSophisticationLevel}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({
                      ...idea,
                      marketSophisticationLevel: Math.min(5, Math.max(1, Number(event.target.value) || 1)) as 1 | 2 | 3 | 4 | 5,
                    }))
                  }
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
            </div>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Mecanismo Unico (IP Asset)</span>
              <textarea
                value={selectedIdea.uniqueMechanismAsset}
                onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, uniqueMechanismAsset: event.target.value }))}
                className="min-h-20 w-full rounded border border-white/10 bg-slate-900/70 p-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Valuation da Big Idea (ativo financeiro)</span>
              <input
                type="number"
                value={Math.round(selectedIdea.assetValue)}
                onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, assetValue: Math.max(0, Number(event.target.value) || 0) }))}
                className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-300">
                <span>Mecanismo do Problema</span>
                <textarea
                  value={selectedIdea.uniqueMechanismProblem}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({ ...idea, uniqueMechanismProblem: event.target.value }))
                  }
                  className="min-h-28 w-full rounded border border-white/10 bg-slate-900/70 p-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>Mecanismo da Solucao (min 300 caracteres)</span>
                <textarea
                  value={selectedIdea.uniqueMechanismSolution}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({ ...idea, uniqueMechanismSolution: event.target.value }))
                  }
                  className="min-h-28 w-full rounded border border-white/10 bg-slate-900/70 p-2 text-sm"
                />
                <p className={hasMechanismDepth ? "text-[#10B981]" : "text-[#EA4335]"}>
                  {selectedIdea.uniqueMechanismSolution.length} caracteres
                </p>
              </label>
            </div>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Intellectual Novelty</span>
              <textarea
                value={selectedIdea.intellectualNovelty}
                onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, intellectualNovelty: event.target.value }))}
                className="min-h-24 w-full rounded border border-white/10 bg-slate-900/70 p-2 text-sm"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-300">
                <span>Prova Social (URL)</span>
                <input
                  value={selectedIdea.proofSocialUrl}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, proofSocialUrl: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>Prova Cientifica (URL)</span>
                <input
                  value={selectedIdea.proofScientificUrl}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({ ...idea, proofScientificUrl: event.target.value }))
                  }
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>Prova Historica (URL)</span>
                <input
                  value={selectedIdea.proofHistoricalUrl}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({ ...idea, proofHistoricalUrl: event.target.value }))
                  }
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-300">
                <span>Swipe de Referencia (URL)</span>
                <input
                  value={selectedIdea.swipeReferenceUrl}
                  onChange={(event) =>
                    patchSelectedIdea((idea) => ({ ...idea, swipeReferenceUrl: event.target.value }))
                  }
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>O que vamos roubar?</span>
                <input
                  value={selectedIdea.whatToSteal}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, whatToSteal: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>O que vamos superar?</span>
                <input
                  value={selectedIdea.whatToBeat}
                  onChange={(event) => patchSelectedIdea((idea) => ({ ...idea, whatToBeat: event.target.value }))}
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs">
              <p className="mb-1 text-slate-200">Copy Health Score: {score}/100</p>
              <div className="h-2 rounded bg-slate-800">
                <div
                  className={`h-2 rounded ${score >= 70 ? "bg-[#10B981]" : "bg-[#EA4335]"}`}
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>
              <p className="mt-2 text-slate-400">
                Regra de bloqueio: Mecanismo Unico &lt; 300 caracteres ou score &lt; 70 impede envio ao squad.
              </p>
              <div className="mt-2 grid gap-1">
                <p className={hasMechanismDepth ? "text-[#10B981]" : "text-[#EA4335]"}>( ) Tem Mecanismo Unico</p>
                <p className={hasCounterIntuitive ? "text-[#10B981]" : "text-[#EA4335]"}>( ) E contra-intuitivo</p>
                <p className={hasIrrefutableProof ? "text-[#10B981]" : "text-[#EA4335]"}>( ) A prova e irrefutavel</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  addActivity(
                    "Copywriter",
                    "Equipe Copy",
                    "enviou draft para revisao do head",
                    selectedIdea.id,
                    `checklist ${hasMechanismDepth && hasCounterIntuitive && hasIrrefutableProof ? "ok" : "incompleto"}`,
                  )
                }
              >
                Enviar para Revisao do Head
              </Button>
              <Button
                type="button"
                className="h-8 px-3 text-xs"
                onClick={approveIdeaAndDispatch}
                disabled={!canDispatch || !canApproveScripts}
              >
                Aprovar Big Idea e enviar para Squads
              </Button>
              <Button type="button" className="h-8 px-3 text-xs" onClick={exportBriefingPdf}>
                Exportar Briefing para PDF
              </Button>
              {selectedIdea.approvedByHead && <Badge variant="success">Aprovada pelo Head</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard de Comparacao de Angulos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={compareA?.id ?? ""}
              onChange={(event) => setCompareAId(event.target.value)}
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
            >
              {ideas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.id} - {idea.title}
                </option>
              ))}
            </select>
            <select
              value={compareB?.id ?? ""}
              onChange={(event) => setCompareBId(event.target.value)}
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
            >
              {ideas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.id} - {idea.title}
                </option>
              ))}
            </select>
          </div>
          {compareA && compareB && (
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs">
              <p>
                {compareA.id}: CPA {compareA.cpaCurrent.toFixed(2)} | ROAS {compareA.roasCurrent.toFixed(2)}
              </p>
              <p>
                {compareB.id}: CPA {compareB.cpaCurrent.toFixed(2)} | ROAS {compareB.roasCurrent.toFixed(2)}
              </p>
              <p className="mt-1 text-[#10B981]">
                Menor CPA historico: {winnerByCpa?.id ?? "--"} ({winnerByCpa?.cpaCurrent.toFixed(2) ?? "--"})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biblioteca de Swipes (Inteligencia Competitiva)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border border-white/10 bg-black/30 p-2 text-xs">
            <p className="mb-1 text-slate-300">Swipe File Dinamico (clonar estrutura de anuncio escalado)</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCloneCreativeId}
                onChange={(event) => setSelectedCloneCreativeId(event.target.value)}
                className="h-8 min-w-56 rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
              >
                {marketCloneCandidates.length === 0 ? (
                  <option value="">Sem candidatos de mercado</option>
                ) : (
                  marketCloneCandidates.map((item) => (
                    <option key={item.creativeId} value={item.creativeId}>
                      {item.creativeId} | {item.source.toUpperCase()} | ROAS {item.realRoas.toFixed(2)}x
                    </option>
                  ))
                )}
              </select>
              <Button type="button" className="h-8 px-3 text-xs" onClick={cloneMarketStructure}>
                Clonar estrutura para analise
              </Button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            <select
              value={newSwipe.market}
              onChange={(event) => setNewSwipe((prev) => ({ ...prev, market: event.target.value as "BR" | "US" }))}
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm"
            >
              <option value="BR">BR</option>
              <option value="US">US</option>
            </select>
            <input
              value={newSwipe.url}
              onChange={(event) => setNewSwipe((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="URL do anuncio/VSL"
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm md:col-span-2"
            />
            <input
              value={newSwipe.mechanism}
              onChange={(event) => setNewSwipe((prev) => ({ ...prev, mechanism: event.target.value }))}
              placeholder="Qual o mecanismo deles?"
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm md:col-span-2"
            />
            <input
              value={newSwipe.whyItWorks}
              onChange={(event) => setNewSwipe((prev) => ({ ...prev, whyItWorks: event.target.value }))}
              placeholder="Por que esta funcionando?"
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm md:col-span-3"
            />
            <input
              value={newSwipe.howWeDifferentiate}
              onChange={(event) => setNewSwipe((prev) => ({ ...prev, howWeDifferentiate: event.target.value }))}
              placeholder="Como podemos ser diferentes?"
              className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-sm md:col-span-2"
            />
          </div>
          <Button type="button" className="h-8 px-3 text-xs" onClick={addSwipe}>
            Adicionar Swipe
          </Button>
          <div className="space-y-2">
            {swipes.map((swipe) => (
              <div key={swipe.id} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                <p className="text-slate-100">
                  {swipe.market} | {swipe.url}
                </p>
                <p className="text-slate-300">Mecanismo: {swipe.mechanism}</p>
                <p className="text-slate-400">Por que funciona: {swipe.whyItWorks}</p>
                <p className="text-[#FFB347]">Como superar: {swipe.howWeDifferentiate}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Writer Focus Mode (Markdown)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded border border-white/10 bg-black/30 p-2 text-xs">
            <p className="mb-1 text-slate-200">Workflow Rule of One (obrigatorio para liberar escrita)</p>
            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={ruleOfOne.idea}
                onChange={(event) => setRuleOfOne((prev) => ({ ...prev, idea: event.target.value }))}
                placeholder="1 Ideia"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
              <input
                value={ruleOfOne.emotion}
                onChange={(event) => setRuleOfOne((prev) => ({ ...prev, emotion: event.target.value }))}
                placeholder="1 Emocao"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
              <input
                value={ruleOfOne.proclamation}
                onChange={(event) => setRuleOfOne((prev) => ({ ...prev, proclamation: event.target.value }))}
                placeholder="1 Proclamacao"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
              <input
                value={ruleOfOne.guruName}
                onChange={(event) => setRuleOfOne((prev) => ({ ...prev, guruName: event.target.value }))}
                placeholder="Especialista/Guru"
                className="rounded border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  if (!ruleOfOne.idea || !ruleOfOne.emotion || !ruleOfOne.proclamation || !ruleOfOne.guruName) {
                    return;
                  }
                  setRuleOfOne((prev) => ({ ...prev, guruApproved: true }));
                  addActivity("Especialista", ruleOfOne.guruName || "Guru", "deu visto editorial", "Rule of One", "tese validada");
                }}
              >
                Visto editorial (Guru)
              </Button>
              {ruleOfOne.guruApproved ? <Badge variant="success">Aprovado para escrita</Badge> : <Badge variant="warning">Escrita bloqueada</Badge>}
            </div>
          </div>
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            disabled={!canWriteScript}
            className="min-h-48 w-full rounded-md border border-white/10 bg-slate-900/70 p-3 font-mono text-sm"
          />
          {!canWriteScript ? (
            <p className="text-xs text-[#EA4335]">
              Escrita bloqueada: defina 1 Ideia, 1 Emocao, 1 Proclamacao e receba o visto do especialista.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span>Palavras: {words}</span>
            <span>Tempo estimado de lead: {estimatedMinutes.toFixed(1)} min</span>
          </div>
          <button
            onClick={() => addActivity("Copywriter", "Equipe Copy", "atualizou roteiro VSL", "Writer Focus Mode", "rascunho markdown")}
            className="rounded border border-[#FF9900]/40 bg-[#FF9900]/20 px-3 py-1 text-xs text-[#FFD39A]"
          >
            Salvar rascunho
          </button>
          <Badge variant="warning">Dossie Secreto ativo</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar Dossier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {copyModule.avatarDossier.map((avatar, index) => (
            <div key={index} className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
              <p>Dor: {avatar.pain}</p>
              <p>Desejo: {avatar.desire}</p>
              <p>Objecao: {avatar.objection}</p>
              <p className="text-[#FF9900]">Insight do Suporte: {avatar.supportInsight}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
