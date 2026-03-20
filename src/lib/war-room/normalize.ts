import { mockWarRoomData } from "./mock-data";
import type { CreativeVerdict, WarRoomData } from "./types";

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : fallback;
}

function toVerdict(value: unknown, fallback: CreativeVerdict): CreativeVerdict {
  return value === "Escalar" || value === "Matar" ? value : fallback;
}

export function normalizeWarRoomData(
  value: unknown,
  source: WarRoomData["source"],
  sourceLabel: string,
): WarRoomData {
  const fallback = mockWarRoomData;
  const input = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const adsInput = typeof input.ads === "object" && input.ads !== null ? (input.ads as Record<string, unknown>) : {};
  const creativesInput = Array.isArray(adsInput.creatives) ? adsInput.creatives : [];

  const creatives = (creativesInput as unknown[]).map((item, index) => {
    const fallbackCreative = fallback.ads.creatives[index] ?? fallback.ads.creatives[0];
    const row = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    return {
      id: toString(row.id, fallbackCreative.id),
      hookRate: toNumber(row.hookRate, fallbackCreative.hookRate),
      holdRate: toNumber(row.holdRate, fallbackCreative.holdRate),
      roas: toNumber(row.roas, fallbackCreative.roas),
      verdict: toVerdict(row.verdict, fallbackCreative.verdict),
    };
  });

  const copyInput = typeof input.copy === "object" && input.copy !== null ? (input.copy as Record<string, unknown>) : {};
  const productionInput =
    typeof copyInput.productionFlow === "object" && copyInput.productionFlow !== null
      ? (copyInput.productionFlow as Record<string, unknown>)
      : {};

  const techInput = typeof input.tech === "object" && input.tech !== null ? (input.tech as Record<string, unknown>) : {};
  const financeInput =
    typeof input.finance === "object" && input.finance !== null ? (input.finance as Record<string, unknown>) : {};

  const normalized: WarRoomData = {
    source,
    sourceLabel,
    updatedAt: toString(input.updatedAt, new Date().toISOString()),
    ads: {
      investmentTotal: toNumber(adsInput.investmentTotal, fallback.ads.investmentTotal),
      avgRoas: toNumber(adsInput.avgRoas, fallback.ads.avgRoas),
      avgCpm: toNumber(adsInput.avgCpm, fallback.ads.avgCpm),
      creatives: creatives.length > 0 ? creatives : fallback.ads.creatives,
    },
    copy: {
      angles: toStringArray(copyInput.angles, fallback.copy.angles),
      hooksBacklog: toStringArray(copyInput.hooksBacklog, fallback.copy.hooksBacklog),
      productionFlow: {
        roteirizando: toStringArray(productionInput.roteirizando, fallback.copy.productionFlow.roteirizando),
        gravando: toStringArray(productionInput.gravando, fallback.copy.productionFlow.gravando),
        editando: toStringArray(productionInput.editando, fallback.copy.productionFlow.editando),
      },
    },
    tech: {
      pageLoadDropOff: toNumber(techInput.pageLoadDropOff, fallback.tech.pageLoadDropOff),
      pageLoadNote: toString(techInput.pageLoadNote, fallback.tech.pageLoadNote),
      vslRetention: toNumber(techInput.vslRetention, fallback.tech.vslRetention),
      vslNote: toString(techInput.vslNote, fallback.tech.vslNote),
      checkoutConversion: toNumber(techInput.checkoutConversion, fallback.tech.checkoutConversion),
      checkoutNote: toString(techInput.checkoutNote, fallback.tech.checkoutNote),
    },
    finance: {
      revenue: toNumber(financeInput.revenue, fallback.finance.revenue),
      approvalRate: toNumber(financeInput.approvalRate, fallback.finance.approvalRate),
      ltv: toNumber(financeInput.ltv, fallback.finance.ltv),
    },
  };

  return normalized;
}
