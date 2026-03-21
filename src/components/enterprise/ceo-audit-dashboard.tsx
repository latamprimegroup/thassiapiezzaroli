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

type PeriodPreset = "today" | "yesterday" | "last_7d" | "this_month" | "last_month";

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

const PIE_COLORS = ["#FF9900", "#10B981", "#3B82F6", "#A855F7", "#EF4444", "#14B8A6", "#F59E0B"];

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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

export function CeoAuditDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingScaleApprovalId, setSavingScaleApprovalId] = useState("");
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAudit();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAudit]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchAudit();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [fetchAudit]);

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

  const marketShareData = useMemo(() => payload?.charts.marketShareByManager ?? [], [payload?.charts.marketShareByManager]);

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

