"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricTooltip } from "@/components/ui/metric-tooltip";
import { computeKpis, isFatigueImminent, isLtvPriority } from "@/lib/metrics/kpis";
import type { SquadKey, WarRoomData } from "@/lib/war-room/types";

type LiveRow = WarRoomData["liveAdsTracking"][number];

type LiveAdsTableProps = {
  rows: LiveRow[];
  title: string;
  subtitle?: string;
  squadFilter?: SquadKey;
  hideRoasReal?: boolean;
  emphasizeRetention?: boolean;
  simplified?: boolean;
  showDeepDive?: boolean;
};

const percent = (value: number) =>
  `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function squadLabel(squad: SquadKey) {
  if (squad === "facebook") {
    return "Facebook";
  }
  if (squad === "tiktok") {
    return "TikTok";
  }
  return "Google/YouTube";
}

const PAGE_SIZE = 120;

function Sparkline({ values, colorClass }: { values: number[]; colorClass: string }) {
  const normalized = values.length > 1 ? values : [0, ...values];
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;

  const points = normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 28" className="mt-1 h-7 w-24 opacity-90">
      <polyline fill="none" strokeWidth="2.2" className={colorClass} points={points} />
    </svg>
  );
}

export function LiveAdsTable({
  rows,
  title,
  subtitle,
  squadFilter,
  hideRoasReal = false,
  emphasizeRetention = false,
  simplified = false,
  showDeepDive = true,
}: LiveAdsTableProps) {
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(
    () => (squadFilter ? rows.filter((row) => row.squad === squadFilter) : rows),
    [rows, squadFilter],
  );
  const minCpa = useMemo(
    () => filteredRows.reduce((min, row) => (row.cpa < min ? row.cpa : min), Number.POSITIVE_INFINITY),
    [filteredRows],
  );
  const ltvThreshold = useMemo(() => {
    const ordered = [...filteredRows].map((row) => row.ltv).sort((a, b) => a - b);
    if (ordered.length === 0) {
      return 0;
    }
    return ordered[Math.floor(ordered.length * 0.7)];
  }, [filteredRows]);

  const prioritizedRows = useMemo(
    () =>
      [...filteredRows].sort((a, b) => {
        const aPriority = isLtvPriority(a, minCpa, ltvThreshold) ? 1 : 0;
        const bPriority = isLtvPriority(b, minCpa, ltvThreshold) ? 1 : 0;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return b.roas - a.roas;
      }),
    [filteredRows, ltvThreshold, minCpa],
  );

  const totalPages = Math.max(1, Math.ceil(prioritizedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = prioritizedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
          <span>
            Linhas renderizadas: {pagedRows.length} / {prioritizedRows.length} (otimizado para alto volume)
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                Anterior
              </button>
              <span>
                Pagina {safePage} de {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                Proxima
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                {!simplified && <th className="px-2 py-2 font-medium">Squad</th>}
                {!simplified && <th className="px-2 py-2 font-medium">Campanha</th>}
                <th className="px-2 py-2 font-medium">Anuncio</th>
                <th className="px-2 py-2 font-medium">
                  <MetricTooltip label="Hook Rate" help="Taxa de gancho = views 3s / impressoes." />
                </th>
                <th className={`px-2 py-2 font-medium ${emphasizeRetention ? "text-violet-300" : ""}`}>
                  <MetricTooltip
                    label="Hold Rate"
                    help="Retencao = views 15s / views 3s."
                    emphasize={emphasizeRetention}
                  />
                </th>
                <th className="px-2 py-2 font-medium">
                  <MetricTooltip label="VSL Efficiency" help="Eficiencia = IC / LP." />
                </th>
                {!simplified && (
                  <th className="px-2 py-2 font-medium">
                    <MetricTooltip label="Page Drop" help="Drop = 1 - (LP Views / Cliques). Alerta acima de 20%." />
                  </th>
                )}
                {!simplified && <th className="px-2 py-2 font-medium">Freq.</th>}
                {!simplified && <th className="px-2 py-2 font-medium">CTR Unico</th>}
                {!simplified && (
                  <th className="px-2 py-2 font-medium">
                    <MetricTooltip label="Burn Rate" help="Indice preditivo de fadiga por frequencia x queda de CTR." />
                  </th>
                )}
                {showDeepDive && <th className="px-2 py-2 font-medium">AOV</th>}
                {showDeepDive && <th className="px-2 py-2 font-medium">Upsell %</th>}
                {showDeepDive && <th className="px-2 py-2 font-medium">LTV</th>}
                {showDeepDive && <th className="px-2 py-2 font-medium">CPA</th>}
                {!hideRoasReal && <th className="px-2 py-2 font-medium">ROAS</th>}
                <th className="px-2 py-2 font-medium">Badges</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const metrics = computeKpis(row);

                return (
                  <tr key={row.id} className="border-b border-white/5 text-slate-100">
                    {!simplified && <td className="px-2 py-3">{squadLabel(row.squad)}</td>}
                    {!simplified && <td className="px-2 py-3">{row.campaign}</td>}
                    <td className="px-2 py-3">{row.adName}</td>
                    <td className="px-2 py-3">
                      {percent(metrics.hookRate)}
                      <Sparkline values={row.trend24h.hookRate} colorClass="stroke-cyan-300" />
                    </td>
                    <td className={`px-2 py-3 ${emphasizeRetention ? "font-semibold text-violet-200" : ""}`}>
                      {percent(metrics.holdRate)}
                      <Sparkline values={row.trend24h.holdRate} colorClass="stroke-violet-300" />
                    </td>
                    <td className="px-2 py-3">{percent(metrics.vslEfficiency)}</td>
                    {!simplified && (
                      <td className={`px-2 py-3 ${metrics.pageDrop > 20 ? "text-[#FF9900]" : ""}`}>
                        {percent(metrics.pageDrop)}
                      </td>
                    )}
                    {!simplified && <td className="px-2 py-3">{row.frequency.toFixed(1)}</td>}
                    {!simplified && <td className="px-2 py-3">{percent(row.uniqueCtr)}</td>}
                    {!simplified && (
                      <td className={`px-2 py-3 ${metrics.predictiveBurnRate > 65 ? "text-[#FF9900] font-semibold" : ""}`}>
                        {metrics.predictiveBurnRate.toFixed(0)}
                      </td>
                    )}
                    {showDeepDive && <td className="px-2 py-3">{currency(row.aov)}</td>}
                    {showDeepDive && <td className="px-2 py-3">{percent(row.upsellConversion)}</td>}
                    {showDeepDive && <td className="px-2 py-3">{currency(row.ltv)}</td>}
                    {showDeepDive && <td className="px-2 py-3">{currency(row.cpa)}</td>}
                    {!hideRoasReal && (
                      <td className="px-2 py-3">
                        {row.roas.toFixed(2)}
                        <Sparkline values={row.trend24h.roas} colorClass="stroke-emerald-300" />
                      </td>
                    )}
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {metrics.hookRate > 30 ? <Badge variant="gold">Gancho de Ouro</Badge> : null}
                        {metrics.holdRate < 20 ? <Badge variant="warning">Gargalo de Retencao</Badge> : null}
                        {metrics.pageDrop > 20 ? <Badge variant="warning">Page Drop Alto</Badge> : null}
                        {row.roas > 2.5 ? <Badge variant="success">WINNER DETECTED</Badge> : null}
                        {metrics.hookRate < 20 ? <Badge variant="danger">Critico</Badge> : null}
                        {isFatigueImminent(row) ? <Badge variant="warning">FADIGA IMINENTE</Badge> : null}
                        {isLtvPriority(row, minCpa, ltvThreshold) ? <Badge variant="sky">PRIORIDADE LTV</Badge> : null}
                        {metrics.hookRate >= 20 && metrics.holdRate >= 20 && row.roas <= 2.5 ? (
                          <Badge variant="default">Estavel</Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
