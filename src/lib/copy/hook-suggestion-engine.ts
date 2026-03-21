import { safeDivide } from "@/lib/metrics/kpis";
import type { WarRoomData } from "@/lib/war-room/types";

export type HookSuggestion = {
  sourceCreativeId: string;
  sourceHookRate: number;
  suggestion: string;
};

function computeHookRatePct(row: WarRoomData["liveAdsTracking"][number]) {
  return safeDivide(row.views3s, row.impressions || 1) * 100;
}

function buildVariation(baseName: string, pattern: string) {
  return `${pattern}: ${baseName}`;
}

export function suggestHookVariationsFromHistory(
  rows: WarRoomData["liveAdsTracking"],
  limit: number = 6,
): HookSuggestion[] {
  const patterns = [
    "Quebra de crença em 5s",
    "Prova visual antes da promessa",
    "Pergunta polarizadora direta",
    "Erro caro que ninguém comenta",
    "Contraste antes/depois com dado real",
    "Micro-história com virada no segundo 7",
  ];

  return [...rows]
    .map((row) => ({ row, hookRate: computeHookRatePct(row) }))
    .sort((a, b) => b.hookRate - a.hookRate)
    .slice(0, limit)
    .map((entry, index) => ({
      sourceCreativeId: entry.row.id,
      sourceHookRate: entry.hookRate,
      suggestion: buildVariation(entry.row.adName, patterns[index % patterns.length]),
    }));
}
