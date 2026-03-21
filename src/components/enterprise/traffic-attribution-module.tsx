"use client";

import { useCallback, useEffect, useState } from "react";
import { useWarRoom } from "@/context/war-room-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContingencyMonitor } from "@/components/war-room/contingency-monitor";
import { computeIntelligenceEngine } from "@/lib/metrics/intelligence-engine";
import { calculateEstimatedNetProfit, toDateOnlyIso } from "@/lib/metrics/daily-settlement";
import type { UserRole } from "@/lib/auth/rbac";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Source = "meta" | "google" | "native";

type TrafficAttributionModuleProps = {
  canInputTrafficSpend: boolean;
  canUseScalingAdvisor: boolean;
  canViewSystemHealthMode: boolean;
  actorName: string;
  actorRole: UserRole;
};

type DailySettlementForm = {
  date: string;
  niche: string;
  adSpend: number;
  salesCount: number;
  grossRevenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  checkoutRate: number;
  winningCreativeId: string;
  audienceInsight: string;
  productionFeedback: string;
};

type DailySettlementSummaryPayload = {
  userId: string;
  pendingStatus: {
    date: string;
    hasRecord: boolean;
  };
  weeklyProfit: number;
  monthlyProfit: number;
  trend: Array<{
    date: string;
    adSpend: number;
    grossRevenue: number;
    netProfit: number;
  }>;
};

type SettlementFeedbackItem = {
  id: string;
  date: string;
  managerName: string;
  niche: string;
  winningCreativeId: string;
  audienceInsight: string;
  productionFeedback: string;
  netProfit: number;
};

type BonusSummaryPayload = {
  monthKey: string;
  userId: string;
  userName: string;
  netProfit: number;
  payoutValue: number;
  commissionPctApplied: number;
  bonusFixedApplied: number;
  progress: {
    currentPct: number;
    nextPct: number;
    missingProfit: number;
    progressPct: number;
    message: string;
  };
  frozenSnapshot: boolean;
};

export function TrafficAttributionModule({
  canInputTrafficSpend,
  canUseScalingAdvisor,
  canViewSystemHealthMode,
  actorName,
  actorRole,
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
  const [deepTrackForm, setDeepTrackForm] = useState({
    leadId: "",
    offerId: data.liveAdsTracking[0]?.id ?? "OFF-001",
    utmSource: "meta",
    utmContent: data.liveAdsTracking[0]?.id ?? "CR-001",
    watchSeconds: 120,
    adCost: 120,
    revenue: 0,
    eventType: "vsl_progress" as "landing_view" | "vsl_progress" | "purchase" | "checkout_start",
  });
  const [timelinePreview, setTimelinePreview] = useState<
    Array<{
      leadId: string;
      stage: "cold" | "warm" | "hot" | "buyer";
      watchMinutes: number;
      source: string;
    }>
  >([]);
  const [dailySettlementForm, setDailySettlementForm] = useState<DailySettlementForm>({
    date: toDateOnlyIso(new Date()),
    niche: "geral",
    adSpend: 0,
    salesCount: 0,
    grossRevenue: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    checkoutRate: 0,
    winningCreativeId: data.liveAdsTracking[0]?.id ?? "CR-001",
    audienceInsight: "",
    productionFeedback: "",
  });
  const [dailySettlementSummary, setDailySettlementSummary] = useState<DailySettlementSummaryPayload | null>(null);
  const [savingDailySettlement, setSavingDailySettlement] = useState(false);
  const [dailySettlementError, setDailySettlementError] = useState("");
  const [bonusSummary, setBonusSummary] = useState<BonusSummaryPayload | null>(null);
  const [settlementFeedback, setSettlementFeedback] = useState<SettlementFeedbackItem[]>([]);
  const [adminSnapshot, setAdminSnapshot] = useState<{
    managers: Array<{
      userId: string;
      userName: string;
      totalNetProfit: number;
      totalGrossRevenue: number;
      totalAdSpend: number;
      daysReported: number;
      topNiche: string;
      avgNetPerDay: number;
    }>;
    niches: Array<{
      niche: string;
      totalNetProfit: number;
      totalGrossRevenue: number;
      totalAdSpend: number;
      daysReported: number;
    }>;
  } | null>(null);
  const [adminFilters, setAdminFilters] = useState({
    managerUserId: "",
    niche: "",
  });
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
  const liveNetProfit = calculateEstimatedNetProfit({
    grossRevenue: dailySettlementForm.grossRevenue,
    adSpend: dailySettlementForm.adSpend,
  }).netProfit;
  const isAdminView = actorRole === "ceo" || actorRole === "financeManager" || actorRole === "cfo";
  const isBonusEligibleRole =
    actorRole === "ceo" ||
    actorRole === "trafficJunior" ||
    actorRole === "trafficSenior" ||
    actorRole === "mediaBuyer" ||
    actorRole === "headTraffic";
  const pendingYesterday = dailySettlementSummary?.pendingStatus && !dailySettlementSummary.pendingStatus.hasRecord;


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

  const fetchTimelinePreview = useCallback(async () => {
    const response = await fetch("/api/lead-intelligence/dashboard", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | {
          dashboard?: {
            timeline?: Array<{
              leadId: string;
              stage: "cold" | "warm" | "hot" | "buyer";
              watchMinutes: number;
              source: string;
            }>;
          };
        }
      | null;
    if (!payload?.dashboard?.timeline) {
      return;
    }
    setTimelinePreview(payload.dashboard.timeline.slice(0, 8));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAssetWorkflow();
      void fetchTimelinePreview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAssetWorkflow, fetchTimelinePreview]);

  async function submitDeepTrackingEvent() {
    if (!deepTrackForm.leadId.trim()) {
      return;
    }
    const response = await fetch("/api/lead-intelligence/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          leadId: deepTrackForm.leadId,
          sessionId: `SESSION-${deepTrackForm.leadId}`,
          offerId: deepTrackForm.offerId,
          utmSource: deepTrackForm.utmSource,
          utmCampaign: `${deepTrackForm.utmSource}|${deepTrackForm.offerId}`,
          utmContent: deepTrackForm.utmContent,
          eventType: deepTrackForm.eventType,
          value: deepTrackForm.watchSeconds,
          adCost: deepTrackForm.adCost,
          revenue: deepTrackForm.revenue,
        },
      }),
    }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    addActivity("Trafego", actorName, "registrou evento deep tracking", deepTrackForm.leadId, `${deepTrackForm.eventType}`);
    setDeepTrackForm((prev) => ({ ...prev, leadId: "", revenue: 0 }));
    void fetchTimelinePreview();
  }

  const fetchDailySettlementSummary = useCallback(async () => {
    const response = await fetch("/api/daily-settlements/summary", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as DailySettlementSummaryPayload | null;
    if (!payload) {
      return;
    }
    setDailySettlementSummary(payload);
  }, []);

  const fetchBonusSummary = useCallback(async () => {
    if (!isBonusEligibleRole) {
      setBonusSummary(null);
      return;
    }
    const response = await fetch("/api/bonus/my-summary", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as BonusSummaryPayload | null;
    if (!payload) {
      return;
    }
    setBonusSummary(payload);
  }, [isBonusEligibleRole]);

  const fetchSettlementFeedback = useCallback(async () => {
    const response = await fetch("/api/daily-settlements?mode=feedback&team=editing&limit=8", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as { items?: SettlementFeedbackItem[] } | null;
    if (!payload?.items) {
      return;
    }
    setSettlementFeedback(payload.items);
  }, []);

  const fetchAdminSnapshot = useCallback(async () => {
    if (!isAdminView) {
      return;
    }
    const query = new URLSearchParams();
    if (adminFilters.managerUserId) {
      query.set("managerUserId", adminFilters.managerUserId);
    }
    if (adminFilters.niche) {
      query.set("niche", adminFilters.niche);
    }
    const response = await fetch(`/api/daily-settlements/admin?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | {
          managers?: Array<{
            userId: string;
            userName: string;
            totalNetProfit: number;
            totalGrossRevenue: number;
            totalAdSpend: number;
            daysReported: number;
            topNiche: string;
            avgNetPerDay: number;
          }>;
          niches?: Array<{
            niche: string;
            totalNetProfit: number;
            totalGrossRevenue: number;
            totalAdSpend: number;
            daysReported: number;
          }>;
        }
      | null;
    if (!payload?.managers || !payload?.niches) {
      return;
    }
    setAdminSnapshot({
      managers: payload.managers,
      niches: payload.niches,
    });
  }, [adminFilters.managerUserId, adminFilters.niche, isAdminView]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDailySettlementSummary();
      void fetchBonusSummary();
      void fetchSettlementFeedback();
      void fetchAdminSnapshot();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAdminSnapshot, fetchBonusSummary, fetchDailySettlementSummary, fetchSettlementFeedback]);

  function validateDailySettlementForm() {
    if (!dailySettlementForm.niche.trim()) {
      return "Informe o nicho da operacao.";
    }
    if (!dailySettlementForm.winningCreativeId.trim()) {
      return "Informe o ID do criativo vencedor.";
    }
    if (!dailySettlementForm.audienceInsight.trim()) {
      return "Audience insight para o time de Copy e obrigatorio.";
    }
    if (!dailySettlementForm.productionFeedback.trim()) {
      return "Production feedback para o time de Edicao e obrigatorio.";
    }
    const numericValues = [
      dailySettlementForm.adSpend,
      dailySettlementForm.salesCount,
      dailySettlementForm.grossRevenue,
      dailySettlementForm.ctr,
      dailySettlementForm.cpc,
      dailySettlementForm.cpm,
      dailySettlementForm.checkoutRate,
    ];
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      return "Todos os campos numericos devem ser validos e >= 0.";
    }
    return "";
  }

  async function saveDailySettlement() {
    const validationError = validateDailySettlementForm();
    if (validationError) {
      setDailySettlementError(validationError);
      return;
    }
    setDailySettlementError("");
    setSavingDailySettlement(true);
    const response = await fetch("/api/daily-settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dailySettlementForm),
    }).catch(() => null);
    setSavingDailySettlement(false);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { error?: string; detail?: string } | null;
      setDailySettlementError(payload?.detail || payload?.error || "Falha ao salvar Daily Settlement.");
      return;
    }
    addActivity(
      "Trafego",
      actorName,
      "salvou daily settlement",
      dailySettlementForm.date,
      `nicho ${dailySettlementForm.niche} | winner ${dailySettlementForm.winningCreativeId}`,
    );
    void fetchDailySettlementSummary();
    void fetchBonusSummary();
    void fetchSettlementFeedback();
    void fetchAdminSnapshot();
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

      {pendingYesterday && (
        <Card className="border-[#FF9900]/40 bg-[#FF9900]/10">
          <CardContent className="p-3 text-sm text-[#FFD39A]">
            Pendencia operacional: nao existe Daily Settlement para {dailySettlementSummary?.pendingStatus.date}. Complete o fechamento para liberar o dia atual.
          </CardContent>
        </Card>
      )}

      {isBonusEligibleRole && (
        <Card className="border-[#10B981]/30 bg-[#10B981]/10">
          <CardHeader>
            <CardTitle className="text-base">Minha Bonificacao Acumulada (Mes Corrente)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded border border-white/10 bg-black/20 p-2">
                <p className="text-slate-300">Payout estimado</p>
                <p className="text-lg text-[#10B981]">{currency(bonusSummary?.payoutValue ?? 0)}</p>
              </div>
              <div className="rounded border border-white/10 bg-black/20 p-2">
                <p className="text-slate-300">% de comissao aplicada</p>
                <p className="text-lg text-slate-100">{(bonusSummary?.commissionPctApplied ?? 0).toFixed(2)}%</p>
              </div>
              <div className="rounded border border-white/10 bg-black/20 p-2">
                <p className="text-slate-300">Lucro liquido do mes</p>
                <p className={(bonusSummary?.netProfit ?? 0) >= 0 ? "text-lg text-emerald-300" : "text-lg text-rose-300"}>
                  {currency(bonusSummary?.netProfit ?? 0)}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-[#10B981]"
                  style={{ width: `${Math.max(0, Math.min(100, bonusSummary?.progress.progressPct ?? 0))}%` }}
                />
              </div>
              <p className="text-slate-200">
                {bonusSummary?.progress.message ??
                  "Sem dados suficientes ainda. Complete os Daily Settlements para acompanhar sua progressao de comissao."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Settlement (Fechamento Diário)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs">
              <p className="text-slate-400">Lucro do Dia (input atual)</p>
              <p className={liveNetProfit >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {currency(liveNetProfit)}
              </p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs">
              <p className="text-slate-400">Lucro da Semana (7D)</p>
              <p className={(dailySettlementSummary?.weeklyProfit ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {currency(dailySettlementSummary?.weeklyProfit ?? 0)}
              </p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs">
              <p className="text-slate-400">Lucro do Mes (30D)</p>
              <p className={(dailySettlementSummary?.monthlyProfit ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {currency(dailySettlementSummary?.monthlyProfit ?? 0)}
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-300">
              <span>Data</span>
              <input
                type="date"
                value={dailySettlementForm.date}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, date: event.target.value }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Nicho</span>
              <input
                value={dailySettlementForm.niche}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, niche: event.target.value }))}
                placeholder="ex: emagrecimento"
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>ID criativo vencedor</span>
              <input
                value={dailySettlementForm.winningCreativeId}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, winningCreativeId: event.target.value }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Sales Count</span>
              <input
                type="number"
                value={dailySettlementForm.salesCount}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, salesCount: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-300">
              <span>Ad Spend</span>
              <input
                type="number"
                value={dailySettlementForm.adSpend}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, adSpend: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Gross Revenue</span>
              <input
                type="number"
                value={dailySettlementForm.grossRevenue}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, grossRevenue: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>CTR (%)</span>
              <input
                type="number"
                value={dailySettlementForm.ctr}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, ctr: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>CPC</span>
              <input
                type="number"
                value={dailySettlementForm.cpc}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, cpc: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>CPM</span>
              <input
                type="number"
                value={dailySettlementForm.cpm}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, cpm: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Checkout Rate (%)</span>
              <input
                type="number"
                value={dailySettlementForm.checkoutRate}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, checkoutRate: Number(event.target.value || 0) }))}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-300">
              <span>Audience Insight (feedback para Copy)</span>
              <textarea
                value={dailySettlementForm.audienceInsight}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, audienceInsight: event.target.value }))}
                className="min-h-20 w-full rounded border border-white/10 bg-slate-900/70 p-2"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-300">
              <span>Production Feedback (feedback para Edicao)</span>
              <textarea
                value={dailySettlementForm.productionFeedback}
                onChange={(event) => setDailySettlementForm((prev) => ({ ...prev, productionFeedback: event.target.value }))}
                className="min-h-20 w-full rounded border border-white/10 bg-slate-900/70 p-2"
              />
            </label>
          </div>

          {dailySettlementError ? <p className="text-xs text-rose-300">{dailySettlementError}</p> : null}
          <Button type="button" className="h-8 px-3 text-xs" onClick={() => void saveDailySettlement()} disabled={savingDailySettlement}>
            {savingDailySettlement ? "Salvando..." : "Salvar Fechamento Diário"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolucao diaria: Investimento vs Lucro Liquido</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {dailySettlementSummary?.trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySettlementSummary.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(value) => currency(Number(value ?? 0))}
                />
                <Legend />
                <Line type="monotone" dataKey="adSpend" name="Investimento" stroke="#FF9900" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="netProfit" name="Lucro Liquido" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-500">Sem historico suficiente para o grafico ainda.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback Loop disparado para Copy e Edicao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {settlementFeedback.length === 0 ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">
              Nenhum feedback recente de Daily Settlement.
            </p>
          ) : (
            settlementFeedback.map((item) => (
              <div key={item.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">
                  {item.date} | {item.managerName} | Nicho: {item.niche}
                </p>
                <p className="text-[#FFB347]">Copy: {item.audienceInsight}</p>
                <p className="text-slate-300">
                  Edicao ({item.winningCreativeId}): {item.productionFeedback}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {isAdminView && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Daily Settlement (CEO) - Ranking por Gestor e Nicho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid gap-2 md:grid-cols-[2fr_2fr_auto]">
              <input
                value={adminFilters.managerUserId}
                onChange={(event) => setAdminFilters((prev) => ({ ...prev, managerUserId: event.target.value }))}
                placeholder="Filtrar por user_id do gestor"
                className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
              />
              <input
                value={adminFilters.niche}
                onChange={(event) => setAdminFilters((prev) => ({ ...prev, niche: event.target.value }))}
                placeholder="Filtrar por nicho"
                className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
              />
              <Button type="button" className="h-8 px-3 text-xs" onClick={() => void fetchAdminSnapshot()}>
                Aplicar filtro
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded border border-white/10 bg-white/5 p-2">
                <p className="mb-1 text-slate-300">Lucro por Gestor</p>
                <div className="space-y-1">
                  {adminSnapshot?.managers.slice(0, 10).map((row) => (
                    <div key={row.userId} className="rounded border border-white/10 bg-black/30 p-2">
                      <p className="text-slate-100">
                        {row.userName} ({row.userId})
                      </p>
                      <p className={row.totalNetProfit >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        Lucro: {currency(row.totalNetProfit)} | Nicho top: {row.topNiche}
                      </p>
                    </div>
                  ))}
                  {!adminSnapshot?.managers.length ? <p className="text-slate-500">Sem dados no periodo.</p> : null}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-white/5 p-2">
                <p className="mb-1 text-slate-300">Lucro por Nicho</p>
                <div className="space-y-1">
                  {adminSnapshot?.niches.slice(0, 10).map((row) => (
                    <div key={row.niche} className="rounded border border-white/10 bg-black/30 p-2">
                      <p className="text-slate-100">{row.niche}</p>
                      <p className={row.totalNetProfit >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        Lucro: {currency(row.totalNetProfit)} | Spend: {currency(row.totalAdSpend)}
                      </p>
                    </div>
                  ))}
                  {!adminSnapshot?.niches.length ? <p className="text-slate-500">Sem dados no periodo.</p> : null}
                </div>
              </div>
            </div>
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
          <CardTitle className="text-base">Deep Tracking Pos-Clique (MVP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={deepTrackForm.leadId}
              onChange={(event) => setDeepTrackForm((prev) => ({ ...prev, leadId: event.target.value }))}
              placeholder="Lead ID"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
            <select
              value={deepTrackForm.eventType}
              onChange={(event) =>
                setDeepTrackForm((prev) => ({
                  ...prev,
                  eventType: event.target.value as "landing_view" | "vsl_progress" | "purchase" | "checkout_start",
                }))
              }
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            >
              <option value="landing_view">landing_view</option>
              <option value="vsl_progress">vsl_progress</option>
              <option value="checkout_start">checkout_start</option>
              <option value="purchase">purchase</option>
            </select>
            <input
              value={deepTrackForm.utmContent}
              onChange={(event) => setDeepTrackForm((prev) => ({ ...prev, utmContent: event.target.value }))}
              placeholder="utm_content / criativo"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
            <input
              type="number"
              value={deepTrackForm.watchSeconds}
              onChange={(event) => setDeepTrackForm((prev) => ({ ...prev, watchSeconds: Number(event.target.value) || 0 }))}
              placeholder="watch sec"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={deepTrackForm.utmSource}
              onChange={(event) => setDeepTrackForm((prev) => ({ ...prev, utmSource: event.target.value }))}
              placeholder="utm_source"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
            <input
              type="number"
              value={deepTrackForm.adCost}
              onChange={(event) => setDeepTrackForm((prev) => ({ ...prev, adCost: Number(event.target.value) || 0 }))}
              placeholder="ad cost"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
            <input
              type="number"
              value={deepTrackForm.revenue}
              onChange={(event) => setDeepTrackForm((prev) => ({ ...prev, revenue: Number(event.target.value) || 0 }))}
              placeholder="revenue"
              className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
            />
          </div>
          <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void submitDeepTrackingEvent()}>
            Registrar evento de lead
          </Button>
          <div className="space-y-1">
            {timelinePreview.map((item) => (
              <div key={item.leadId} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">
                  {item.leadId} | {item.stage}
                </p>
                <p className="text-slate-300">
                  Fonte {item.source} | watch {item.watchMinutes.toFixed(1)} min
                </p>
              </div>
            ))}
            {timelinePreview.length === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-500">Sem timeline de leads ainda.</p>
            ) : null}
          </div>
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
