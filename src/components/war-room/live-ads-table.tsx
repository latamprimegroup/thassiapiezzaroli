"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricTooltip } from "@/components/ui/metric-tooltip";
import { computeKpis } from "@/lib/metrics/kpis";
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
};

const percent = (value: number) =>
  `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

function squadLabel(squad: SquadKey) {
  return squad === "facebook" ? "Facebook" : "Google/YouTube";
}

const PAGE_SIZE = 120;

export function LiveAdsTable({
  rows,
  title,
  subtitle,
  squadFilter,
  hideRoasReal = false,
  emphasizeRetention = false,
  simplified = false,
}: LiveAdsTableProps) {
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(
    () => (squadFilter ? rows.filter((row) => row.squad === squadFilter) : rows),
    [rows, squadFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
          <span>
            Linhas renderizadas: {pagedRows.length} / {filteredRows.length} (otimizado para alto volume)
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
                    <td className="px-2 py-3">{percent(metrics.hookRate)}</td>
                    <td className={`px-2 py-3 ${emphasizeRetention ? "font-semibold text-violet-200" : ""}`}>
                      {percent(metrics.holdRate)}
                    </td>
                    <td className="px-2 py-3">{percent(metrics.vslEfficiency)}</td>
                    {!hideRoasReal && <td className="px-2 py-3">{row.roas.toFixed(2)}</td>}
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {metrics.hookRate > 30 ? <Badge variant="gold">Gancho de Ouro</Badge> : null}
                        {metrics.holdRate < 20 ? <Badge variant="warning">Gargalo de Retencao</Badge> : null}
                        {row.roas > 2.5 ? <Badge variant="success">WINNER DETECTED</Badge> : null}
                        {metrics.hookRate < 20 ? <Badge variant="danger">Critico</Badge> : null}
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
