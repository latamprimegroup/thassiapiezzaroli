"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SquadKey, WarRoomData } from "@/lib/war-room/types";

type LiveRow = WarRoomData["liveAdsTracking"][number];

type LiveAdsTableProps = {
  rows: LiveRow[];
  title: string;
  subtitle?: string;
  squadFilter?: SquadKey;
};

const percent = (value: number) =>
  `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

function computeMetrics(row: LiveRow) {
  const hookRate = row.impressions > 0 ? (row.views3s / row.impressions) * 100 : 0;
  const holdRate = row.views3s > 0 ? (row.views15s / row.views3s) * 100 : 0;
  const vslEfficiency = row.lp > 0 ? (row.ic / row.lp) * 100 : 0;
  return { hookRate, holdRate, vslEfficiency };
}

function squadLabel(squad: SquadKey) {
  return squad === "facebook" ? "Facebook" : "Google/YouTube";
}

export function LiveAdsTable({ rows, title, subtitle, squadFilter }: LiveAdsTableProps) {
  const filteredRows = squadFilter ? rows.filter((row) => row.squad === squadFilter) : rows;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="px-2 py-2 font-medium">Squad</th>
                <th className="px-2 py-2 font-medium">Campanha</th>
                <th className="px-2 py-2 font-medium">Anuncio</th>
                <th className="px-2 py-2 font-medium">Hook Rate</th>
                <th className="px-2 py-2 font-medium">Hold Rate</th>
                <th className="px-2 py-2 font-medium">VSL Efficiency</th>
                <th className="px-2 py-2 font-medium">ROAS</th>
                <th className="px-2 py-2 font-medium">Badges</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const metrics = computeMetrics(row);

                return (
                  <tr key={row.id} className="border-b border-white/5 text-slate-100">
                    <td className="px-2 py-3">{squadLabel(row.squad)}</td>
                    <td className="px-2 py-3">{row.campaign}</td>
                    <td className="px-2 py-3">{row.adName}</td>
                    <td className="px-2 py-3">{percent(metrics.hookRate)}</td>
                    <td className="px-2 py-3">{percent(metrics.holdRate)}</td>
                    <td className="px-2 py-3">{percent(metrics.vslEfficiency)}</td>
                    <td className="px-2 py-3">{row.roas.toFixed(2)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {metrics.hookRate > 30 ? <Badge variant="gold">Gancho de Ouro</Badge> : null}
                        {metrics.holdRate < 20 ? <Badge variant="danger">Gargalo de Retencao</Badge> : null}
                        {row.roas > 2.5 ? <Badge variant="success">WINNER DETECTED</Badge> : null}
                        {metrics.hookRate <= 30 && metrics.holdRate >= 20 && row.roas <= 2.5 ? (
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
