"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserRole } from "@/lib/auth/rbac";

type PeriodPreset = "today" | "yesterday" | "last_7d" | "this_month" | "last_month";

type CeoAuditDashboardProps = {
  actorRole: UserRole;
};

type CeoAuditPayload = {
  cards: {
    netProfitGlobal: number;
    investmentGlobal: number;
    grossRevenueGlobal: number;
    roasMedioReal: number;
    efficiencyScore: number;
  };
  ranking: Array<{
    position: number;
    userId: string;
    managerName: string;
    niche: string;
    totalAdSpend: number;
    totalGrossRevenue: number;
    totalNetProfit: number;
    marginPct: number;
    criticalAlert7d: boolean;
    topScaler: boolean;
  }>;
  charts: {
    profitByNiche: Array<{
      label: string;
      netProfit: number;
      grossRevenue: number;
      adSpend: number;
    }>;
    profitByOffer: Array<{
      label: string;
      netProfit: number;
      grossRevenue: number;
      adSpend: number;
    }>;
    marketShareByManager: Array<{
      managerName: string;
      grossRevenue: number;
      sharePct: number;
    }>;
  };
  scaleAlerts: Array<{
    winningCreativeId: string;
    grossRevenue7d: number;
    netProfit7d: number;
    managerNames: string[];
    daysReported: number;
    lastDate: string;
    eligibleScaleVertical: boolean;
  }>;
  detailByManager: Array<{
    id: string;
    date: string;
    niche: string;
    adSpend: number;
    grossRevenue: number;
    netProfit: number;
    winningCreativeId: string;
    audienceInsight: string;
    productionFeedback: string;
  }>;
  filters: {
    preset: PeriodPreset;
    startDate: string;
    endDate: string;
    managerUserId: string;
    niche: string;
    availableManagers: Array<{
      userId: string;
      managerName: string;
    }>;
    availableNiches: string[];
  };
};

type BonusSettingsPayload = {
  settings: {
    managerRules: Array<{
      userId: string;
      userName: string;
      commissionPct: number;
      active: boolean;
    }>;
    ladderRules: Array<{
      id: string;
      minNetProfit: number;
      commissionPct: number;
      bonusFixed: number;
    }>;
    updatedAt: string;
    updatedBy: string;
  };
};

type BonusPayoutPayload = {
  monthKey: string;
  frozenSnapshot: boolean;
  summary: {
    totalNetProfit: number;
    totalAdSpend: number;
    totalGrossRevenue: number;
    totalPayout: number;
  };
  rows: Array<{
    userId: string;
    userName: string;
    niche: string;
    netProfit: number;
    commissionPctApplied: number;
    bonusFixedApplied: number;
    payoutValue: number;
    ruleSource: "manager_override" | "ladder";
  }>;
  approvals: Array<{
    id: string;
    monthKey: string;
    approvedBy: string;
    approvedAt: string;
    totalPayout: number;
  }>;
};

const PIE_COLORS = ["#FF9900", "#10B981", "#3B82F6", "#A855F7", "#EF4444", "#14B8A6", "#F59E0B"];

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shortPresetLabel(value: PeriodPreset) {
  switch (value) {
    case "today":
      return "Hoje";
    case "yesterday":
      return "Ontem";
    case "last_7d":
      return "Ultimos 7D";
    case "last_month":
      return "Mes Passado";
    default:
      return "Este Mes";
  }
}

export function CeoAuditDashboard({ actorRole }: CeoAuditDashboardProps) {
  const isCeo = actorRole === "ceo";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingScaleApprovalId, setSavingScaleApprovalId] = useState("");
  const [savingPayoutApproval, setSavingPayoutApproval] = useState(false);
  const [savingBonusSettings, setSavingBonusSettings] = useState(false);
  const [bonusSettings, setBonusSettings] = useState<BonusSettingsPayload["settings"] | null>(null);
  const [payoutPayload, setPayoutPayload] = useState<BonusPayoutPayload | null>(null);
  const [payoutMonth, setPayoutMonth] = useState(currentMonthKey());
  const [managerPctDraft, setManagerPctDraft] = useState<Record<string, string>>({});
  const [ladderDraft, setLadderDraft] = useState<Array<{ id: string; minNetProfit: number; commissionPct: number; bonusFixed: number }>>([]);
  const [filters, setFilters] = useState<{
    preset: PeriodPreset;
    managerUserId: string;
    niche: string;
  }>({
    preset: "this_month",
    managerUserId: "",
    niche: "",
  });
  const [payload, setPayload] = useState<CeoAuditPayload | null>(null);

  const fetchAudit = useCallback(async () => {
    setError("");
    const query = new URLSearchParams();
    query.set("preset", filters.preset);
    if (filters.managerUserId) {
      query.set("managerUserId", filters.managerUserId);
    }
    if (filters.niche) {
      query.set("niche", filters.niche);
    }
    const response = await fetch(`/api/daily-settlements/ceo-audit?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
      setLoading(false);
      setError(response?.status === 403 ? "Acesso restrito ao CEO/Admin." : "Falha ao carregar CEO Audit Dashboard.");
      return;
    }
    const data = (await response.json().catch(() => null)) as CeoAuditPayload | null;
    if (!data) {
      setLoading(false);
      setError("Resposta invalida do dashboard de auditoria.");
      return;
    }
    setPayload(data);
    setLoading(false);
  }, [filters.managerUserId, filters.niche, filters.preset]);

  const fetchBonusSettings = useCallback(async () => {
    if (!isCeo) {
      return;
    }
    const response = await fetch("/api/bonus/settings", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const data = (await response.json().catch(() => null)) as BonusSettingsPayload | null;
    if (!data?.settings) {
      return;
    }
    setBonusSettings(data.settings);
    const pctDraft: Record<string, string> = {};
    for (const rule of data.settings.managerRules) {
      pctDraft[rule.userId] = Number(rule.commissionPct).toFixed(2);
    }
    setManagerPctDraft(pctDraft);
    setLadderDraft(data.settings.ladderRules);
  }, [isCeo]);

  const fetchPayout = useCallback(async () => {
    const query = new URLSearchParams();
    query.set("month", payoutMonth);
    if (filters.managerUserId) {
      query.set("userId", filters.managerUserId);
    }
    if (filters.niche) {
      query.set("niche", filters.niche);
    }
    const response = await fetch(`/api/bonus/payout?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const data = (await response.json().catch(() => null)) as BonusPayoutPayload | null;
    if (!data) {
      return;
    }
    setPayoutPayload(data);
  }, [filters.managerUserId, filters.niche, payoutMonth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAudit();
      void fetchPayout();
      void fetchBonusSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAudit, fetchBonusSettings, fetchPayout]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchAudit();
      void fetchPayout();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [fetchAudit, fetchPayout]);

  async function approveScaleVertical(item: CeoAuditPayload["scaleAlerts"][number]) {
    const message = [
      "CEO AUDIT: APROVACAO DE ESCALA VERTICAL",
      `Criativo/Oferta: ${item.winningCreativeId}`,
      `Receita 7D: ${currency(item.grossRevenue7d)}`,
      `Lucro 7D: ${currency(item.netProfit7d)}`,
      `Gestores: ${item.managerNames.join(", ")}`,
      "Acao: Aumentar budget de forma controlada e monitorar margem liquida em 24h.",
    ].join(" | ");
    setSavingScaleApprovalId(item.winningCreativeId);
    const response = await fetch("/api/notify-squad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => null);
    setSavingScaleApprovalId("");
    if (!response?.ok) {
      setError("Falha ao enviar aprovacao de escala vertical.");
      return;
    }
    void fetchAudit();
  }

  async function approvePayout() {
    if (!isCeo) {
      setError("Somente CEO pode aprovar pagamentos.");
      return;
    }
    setSavingPayoutApproval(true);
    const response = await fetch("/api/bonus/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthKey: payoutMonth,
        note: "Aprovacao de payout via CEO Audit Dashboard",
      }),
    }).catch(() => null);
    setSavingPayoutApproval(false);
    if (!response?.ok) {
      setError("Falha ao aprovar payout do mes.");
      return;
    }
    void fetchPayout();
  }

  async function saveBonusSettings() {
    if (!isCeo || !bonusSettings) {
      return;
    }
    const managerRules = Object.entries(managerPctDraft).map(([userId, pct]) => {
      const fromCurrent = bonusSettings.managerRules.find((item) => item.userId === userId);
      const fromPayout = payoutPayload?.rows.find((item) => item.userId === userId);
      return {
        userId,
        userName: fromCurrent?.userName ?? fromPayout?.userName ?? userId,
        commissionPct: Number(pct || 0),
        active: true,
      };
    });
    setSavingBonusSettings(true);
    const response = await fetch("/api/bonus/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        managerRules,
        ladderRules: ladderDraft,
      }),
    }).catch(() => null);
    setSavingBonusSettings(false);
    if (!response?.ok) {
      setError("Falha ao salvar configuracoes de comissionamento.");
      return;
    }
    void fetchBonusSettings();
    void fetchPayout();
  }

  const marketShareData = useMemo(() => payload?.charts.marketShareByManager ?? [], [payload?.charts.marketShareByManager]);
  const managerRuleRows = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string }>();
    for (const item of bonusSettings?.managerRules ?? []) {
      map.set(item.userId, { userId: item.userId, userName: item.userName });
    }
    for (const item of payoutPayload?.rows ?? []) {
      if (!map.has(item.userId)) {
        map.set(item.userId, { userId: item.userId, userName: item.userName });
      }
    }
    return [...map.values()];
  }, [bonusSettings?.managerRules, payoutPayload?.rows]);

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-white/10 bg-[#050505]">
        <CardHeader>
          <CardTitle className="text-base">CEO Audit Dashboard & Ranking de Performance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs">
            <p className="text-slate-300">Net Profit Global ({shortPresetLabel(filters.preset)})</p>
            <p className={(payload?.cards.netProfitGlobal ?? 0) >= 0 ? "text-lg text-[#10B981]" : "text-lg text-[#EA4335]"}>
              {currency(payload?.cards.netProfitGlobal ?? 0)}
            </p>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-slate-300">Investment Global ({shortPresetLabel(filters.preset)})</p>
            <p className="text-lg text-slate-100">{currency(payload?.cards.investmentGlobal ?? 0)}</p>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-slate-300">ROAS Medio Real</p>
            <p className="text-lg text-slate-100">{(payload?.cards.roasMedioReal ?? 0).toFixed(2)}x</p>
          </div>
          <div className="rounded border border-[#FF9900]/30 bg-[#FF9900]/10 p-3 text-xs">
            <p className="text-slate-300">Efficiency Score (0-100)</p>
            <p className="text-lg text-[#FFD39A]">{(payload?.cards.efficiencyScore ?? 0).toFixed(1)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            value={filters.preset}
            onChange={(event) => setFilters((prev) => ({ ...prev, preset: event.target.value as PeriodPreset }))}
            className="h-8 rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
          >
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="last_7d">Ultimos 7D</option>
            <option value="this_month">Este Mes</option>
            <option value="last_month">Mes Passado</option>
          </select>
          <select
            value={filters.managerUserId}
            onChange={(event) => setFilters((prev) => ({ ...prev, managerUserId: event.target.value }))}
            className="h-8 rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
          >
            <option value="">Todos os gestores</option>
            {(payload?.filters.availableManagers ?? []).map((item) => (
              <option key={item.userId} value={item.userId}>
                {item.managerName} ({item.userId})
              </option>
            ))}
          </select>
          <select
            value={filters.niche}
            onChange={(event) => setFilters((prev) => ({ ...prev, niche: event.target.value }))}
            className="h-8 rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
          >
            <option value="">Todos os nichos</option>
            {(payload?.filters.availableNiches ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button type="button" className="h-8 px-3 text-xs" onClick={() => void fetchAudit()}>
            Atualizar
          </Button>
        </CardContent>
        <CardContent className="pt-0 text-[11px] text-slate-400">
          Janela ativa: {payload?.filters.startDate ?? "--"} ate {payload?.filters.endDate ?? "--"}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modulo de Bonificacao - Profit Share 9D</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid gap-2 md:grid-cols-[180px_auto_auto_auto]">
            <label className="space-y-1 text-slate-300">
              <span>Mes de referencia</span>
              <input
                type="month"
                value={payoutMonth}
                onChange={(event) => setPayoutMonth(event.target.value)}
                className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
              />
            </label>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-slate-400">Payout total previsto</p>
              <p className="text-base text-[#10B981]">{currency(payoutPayload?.summary.totalPayout ?? 0)}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-slate-400">Lucro liquido base</p>
              <p className="text-base text-slate-100">{currency(payoutPayload?.summary.totalNetProfit ?? 0)}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-slate-400">Status de fechamento</p>
              <p className={payoutPayload?.frozenSnapshot ? "text-emerald-300" : "text-amber-300"}>
                {payoutPayload?.frozenSnapshot ? "Snapshot mensal congelado" : "Mes corrente (tempo real)"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-8 px-3 text-xs" onClick={() => void fetchPayout()}>
              Atualizar payout
            </Button>
            <Button
              type="button"
              className="h-8 px-3 text-xs"
              onClick={() => void approvePayout()}
              disabled={!isCeo || savingPayoutApproval}
            >
              {savingPayoutApproval ? "Aprovando..." : "Aprovar Pagamento"}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Gestor</th>
                  <th className="py-2 pr-3">Nicho</th>
                  <th className="py-2 pr-3">Lucro Mês</th>
                  <th className="py-2 pr-3">% Aplicada</th>
                  <th className="py-2 pr-3">Bônus Fixo</th>
                  <th className="py-2 pr-3">Payout</th>
                  <th className="py-2 pr-3">Regra</th>
                </tr>
              </thead>
              <tbody>
                {(payoutPayload?.rows ?? []).map((row) => (
                  <tr key={`${row.userId}-${row.niche}`} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-slate-100">{row.userName}</td>
                    <td className="py-2 pr-3 text-slate-300">{row.niche}</td>
                    <td className={row.netProfit >= 0 ? "py-2 pr-3 text-emerald-300" : "py-2 pr-3 text-rose-300"}>{currency(row.netProfit)}</td>
                    <td className="py-2 pr-3 text-slate-300">{row.commissionPctApplied.toFixed(2)}%</td>
                    <td className="py-2 pr-3 text-slate-300">{currency(row.bonusFixedApplied)}</td>
                    <td className="py-2 pr-3 text-[#FFD39A]">{currency(row.payoutValue)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={row.ruleSource === "manager_override" ? "success" : "default"}>
                        {row.ruleSource === "manager_override" ? "Override Gestor" : "Escada"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(payoutPayload?.rows.length ?? 0) === 0 ? <p className="text-slate-500">Nenhum gestor elegivel no periodo.</p> : null}
          {(payoutPayload?.approvals ?? []).length > 0 ? (
            <p className="text-[11px] text-slate-400">
              Ultima aprovacao: {(payoutPayload?.approvals[0]?.approvedAt ?? "").replace("T", " ").slice(0, 16)} por{" "}
              {payoutPayload?.approvals[0]?.approvedBy}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isCeo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settings de Comissionamento (CEO)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-2 text-slate-300">Percentual por gestor</p>
              <div className="grid gap-2 md:grid-cols-2">
                {managerRuleRows.map((row) => (
                  <label key={row.userId} className="rounded border border-white/10 bg-black/30 p-2">
                    <span className="mb-1 block text-slate-300">
                      {row.userName} ({row.userId})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={managerPctDraft[row.userId] ?? ""}
                      onChange={(event) =>
                        setManagerPctDraft((prev) => ({
                          ...prev,
                          [row.userId]: event.target.value,
                        }))
                      }
                      className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-2 text-slate-300">Escada de performance</p>
              <div className="space-y-2">
                {ladderDraft.map((rule, index) => (
                  <div key={rule.id} className="grid gap-2 md:grid-cols-[1.3fr_1fr_1fr]">
                    <input
                      type="number"
                      min={0}
                      value={rule.minNetProfit}
                      onChange={(event) =>
                        setLadderDraft((prev) =>
                          prev.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, minNetProfit: Number(event.target.value || 0) } : item,
                          ),
                        )
                      }
                      className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={rule.commissionPct}
                      onChange={(event) =>
                        setLadderDraft((prev) =>
                          prev.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, commissionPct: Number(event.target.value || 0) } : item,
                          ),
                        )
                      }
                      className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
                    />
                    <input
                      type="number"
                      min={0}
                      value={rule.bonusFixed}
                      onChange={(event) =>
                        setLadderDraft((prev) =>
                          prev.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, bonusFixed: Number(event.target.value || 0) } : item,
                          ),
                        )
                      }
                      className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Colunas: lucro minimo mensal | % de comissao | bonus fixo.
              </p>
            </div>
            <Button type="button" className="h-8 px-3 text-xs" onClick={() => void saveBonusSettings()} disabled={savingBonusSettings}>
              {savingBonusSettings ? "Salvando..." : "Salvar regras de bonificacao"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de Gestores (Leaderboard)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Gestor</th>
                    <th className="py-2 pr-3">Nicho</th>
                    <th className="py-2 pr-3">Gasto Total</th>
                    <th className="py-2 pr-3">Faturamento</th>
                    <th className="py-2 pr-3">Lucro Liquido</th>
                    <th className="py-2 pr-3">% Margem</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.ranking ?? []).map((row) => (
                    <tr key={row.userId} className="border-t border-white/10">
                      <td className="py-2 pr-3">{row.position}</td>
                      <td className="py-2 pr-3 text-slate-100">{row.managerName}</td>
                      <td className="py-2 pr-3 text-slate-300">{row.niche}</td>
                      <td className="py-2 pr-3 text-slate-300">{currency(row.totalAdSpend)}</td>
                      <td className="py-2 pr-3 text-slate-300">{currency(row.totalGrossRevenue)}</td>
                      <td className={row.totalNetProfit >= 0 ? "py-2 pr-3 text-[#10B981]" : "py-2 pr-3 text-[#EA4335]"}>
                        {currency(row.totalNetProfit)}
                      </td>
                      <td className={row.marginPct >= 0 ? "py-2 pr-3 text-[#10B981]" : "py-2 pr-3 text-[#EA4335]"}>
                        {row.marginPct.toFixed(2)}%
                      </td>
                      <td className="py-2 pr-3">
                        {row.topScaler ? <Badge variant="success">Top Scaler</Badge> : null}
                        {row.criticalAlert7d ? <Badge variant="danger">Critical Alert</Badge> : null}
                        {!row.topScaler && !row.criticalAlert7d ? <Badge variant="default">Stable</Badge> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && (payload?.ranking.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Sem dados de ranking no periodo selecionado.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas de Escala (Regra 70k/7D)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(payload?.scaleAlerts ?? []).map((item) => (
              <div key={item.winningCreativeId} className="rounded border border-[#10B981]/30 bg-[#10B981]/10 p-2">
                <p className="text-slate-100">{item.winningCreativeId}</p>
                <p className="text-slate-300">
                  Receita 7D: {currency(item.grossRevenue7d)} | Lucro 7D: {currency(item.netProfit7d)}
                </p>
                <p className="text-slate-400">Gestores: {item.managerNames.join(", ")}</p>
                <Button
                  type="button"
                  className="mt-2 h-7 px-2 text-[11px]"
                  onClick={() => void approveScaleVertical(item)}
                  disabled={savingScaleApprovalId === item.winningCreativeId}
                >
                  {savingScaleApprovalId === item.winningCreativeId ? "Enviando..." : "Aprovar Escala Vertical"}
                </Button>
              </div>
            ))}
            {!loading && (payload?.scaleAlerts.length ?? 0) === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-500">
                Nenhuma oferta/criativo atingiu 70k/7D nos settlements recentes.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benchmark: Lucro Liquido por Nicho</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload?.charts.profitByNiche ?? []}>
                <XAxis dataKey="label" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(value) => currency(Number(value ?? 0))}
                />
                <Legend />
                <Bar dataKey="netProfit" name="Lucro Liquido" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benchmark: Lucro Liquido por Oferta/Criativo Winner</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload?.charts.profitByOffer ?? []}>
                <XAxis dataKey="label" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(value) => currency(Number(value ?? 0))}
                />
                <Legend />
                <Bar dataKey="netProfit" name="Lucro Liquido" fill="#FF9900" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market Share Interno (Faturamento por Gestor)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={marketShareData} dataKey="grossRevenue" nameKey="managerName" outerRadius={90}>
                  {marketShareData.map((entry, index) => (
                    <Cell key={entry.managerName} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(value, _name, item) => {
                    const share = Number((item?.payload as { sharePct?: number } | undefined)?.sharePct ?? 0);
                    return [`${currency(Number(value ?? 0))} (${share.toFixed(1)}%)`, "Faturamento"];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {payload?.filters.managerUserId && payload.detailByManager.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Settlement detalhado do gestor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {payload.detailByManager.map((row) => (
              <div key={row.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">
                  {row.date} | {row.niche} | Winner {row.winningCreativeId}
                </p>
                <p className="text-slate-300">
                  Spend {currency(row.adSpend)} | Receita {currency(row.grossRevenue)} | Lucro {currency(row.netProfit)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error ? (
        <Card className="border-rose-300/30 bg-rose-500/10">
          <CardContent className="p-3 text-xs text-rose-100">{error}</CardContent>
        </Card>
      ) : null}
    </section>
  );
}

