import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { dayRangeFromToday, toDateOnlyIso } from "@/lib/metrics/daily-settlement";
import { listDailySettlements, type DailySettlementRecord } from "@/lib/persistence/daily-settlement-repository";

export const runtime = "nodejs";

type PeriodPreset = "today" | "yesterday" | "last_7d" | "this_month" | "last_month";

const ADMIN_ROLES = new Set(["ceo", "financeManager", "cfo"]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolvePeriodRange(preset: PeriodPreset) {
  const now = new Date();
  const today = toDateOnlyIso(now);
  if (preset === "today") {
    return { startDate: today, endDate: today };
  }
  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = toDateOnlyIso(yesterday);
    return { startDate: day, endDate: day };
  }
  if (preset === "last_7d") {
    return dayRangeFromToday(7);
  }
  if (preset === "last_month") {
    const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(startCurrentMonth);
    startLastMonth.setMonth(startCurrentMonth.getMonth() - 1);
    const endLastMonth = new Date(startCurrentMonth);
    endLastMonth.setDate(0);
    return {
      startDate: toDateOnlyIso(startLastMonth),
      endDate: toDateOnlyIso(endLastMonth),
    };
  }
  return {
    startDate: `${today.slice(0, 8)}01`,
    endDate: today,
  };
}

function sumNumbers<T>(items: T[], selector: (row: T) => number) {
  return items.reduce((acc, item) => acc + selector(item), 0);
}

function computeEfficiencyScore(records: DailySettlementRecord[]) {
  const totalNetProfit = sumNumbers(records, (row) => row.netProfit);
  const totalAdSpend = sumNumbers(records, (row) => row.adSpend);
  const totalGrossRevenue = sumNumbers(records, (row) => row.grossRevenue);
  const marginPct = totalGrossRevenue > 0 ? (totalNetProfit / totalGrossRevenue) * 100 : 0;
  const spendEfficiencyPct = totalAdSpend > 0 ? (totalNetProfit / totalAdSpend) * 100 : 0;
  const raw = marginPct * 0.6 + spendEfficiencyPct * 0.4;
  return clamp(Number(raw.toFixed(2)), 0, 100);
}

function topNicheForManager(rows: DailySettlementRecord[]) {
  const byNiche = new Map<string, number>();
  for (const row of rows) {
    byNiche.set(row.niche, (byNiche.get(row.niche) ?? 0) + row.netProfit);
  }
  return [...byNiche.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "geral";
}

function toUniqueArray(values: string[]) {
  return [...new Set(values)].filter((item) => item.trim().length > 0).sort((a, b) => a.localeCompare(b));
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Sem permissao para CEO Audit Dashboard." }, { status: 403 });
  }

  const url = new URL(request.url);
  const presetRaw = String(url.searchParams.get("preset") ?? "this_month");
  const preset: PeriodPreset =
    presetRaw === "today" || presetRaw === "yesterday" || presetRaw === "last_7d" || presetRaw === "this_month" || presetRaw === "last_month"
      ? presetRaw
      : "this_month";
  const { startDate, endDate } = resolvePeriodRange(preset);
  const managerUserId = String(url.searchParams.get("managerUserId") ?? "").trim() || undefined;
  const niche = String(url.searchParams.get("niche") ?? "").trim() || undefined;

  const [records, allRecordsForFilter, last7dRecords] = await Promise.all([
    listDailySettlements({
      startDate,
      endDate,
      userId: managerUserId,
      niche,
      limit: 5000,
    }),
    listDailySettlements({
      startDate,
      endDate,
      limit: 8000,
    }),
    listDailySettlements({
      ...dayRangeFromToday(7),
      limit: 8000,
    }),
  ]);

  const totalNetProfit = sumNumbers(records, (row) => row.netProfit);
  const totalAdSpend = sumNumbers(records, (row) => row.adSpend);
  const totalGrossRevenue = sumNumbers(records, (row) => row.grossRevenue);
  const roasMedioReal = totalAdSpend > 0 ? totalGrossRevenue / totalAdSpend : 0;
  const efficiencyScore = computeEfficiencyScore(records);

  const groupedByManager = new Map<string, DailySettlementRecord[]>();
  for (const row of records) {
    const current = groupedByManager.get(row.userId) ?? [];
    current.push(row);
    groupedByManager.set(row.userId, current);
  }
  const last7dByManager = new Map<string, number>();
  for (const row of last7dRecords) {
    last7dByManager.set(row.userId, (last7dByManager.get(row.userId) ?? 0) + row.netProfit);
  }

  const ranking = [...groupedByManager.entries()]
    .map(([userId, rows]) => {
      const adSpend = sumNumbers(rows, (row) => row.adSpend);
      const grossRevenue = sumNumbers(rows, (row) => row.grossRevenue);
      const netProfit = sumNumbers(rows, (row) => row.netProfit);
      const marginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
      return {
        userId,
        managerName: rows[0]?.userName ?? userId,
        niche: topNicheForManager(rows),
        totalAdSpend: adSpend,
        totalGrossRevenue: grossRevenue,
        totalNetProfit: netProfit,
        marginPct,
        criticalAlert7d: (last7dByManager.get(userId) ?? 0) < 0,
      };
    })
    .sort((a, b) => b.totalNetProfit - a.totalNetProfit)
    .map((row, index) => ({
      ...row,
      position: index + 1,
      topScaler: index === 0,
    }));

  const groupedByNiche = new Map<string, { netProfit: number; grossRevenue: number; adSpend: number }>();
  for (const row of records) {
    const current = groupedByNiche.get(row.niche) ?? { netProfit: 0, grossRevenue: 0, adSpend: 0 };
    current.netProfit += row.netProfit;
    current.grossRevenue += row.grossRevenue;
    current.adSpend += row.adSpend;
    groupedByNiche.set(row.niche, current);
  }
  const profitByNiche = [...groupedByNiche.entries()]
    .map(([label, values]) => ({
      label,
      ...values,
    }))
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 12);

  const groupedByOffer = new Map<string, { netProfit: number; grossRevenue: number; adSpend: number }>();
  for (const row of records) {
    const offerKey = row.winningCreativeId.trim() || "SEM_ID";
    const current = groupedByOffer.get(offerKey) ?? { netProfit: 0, grossRevenue: 0, adSpend: 0 };
    current.netProfit += row.netProfit;
    current.grossRevenue += row.grossRevenue;
    current.adSpend += row.adSpend;
    groupedByOffer.set(offerKey, current);
  }
  const profitByOffer = [...groupedByOffer.entries()]
    .map(([label, values]) => ({
      label,
      ...values,
    }))
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 12);

  const marketShareByManager = ranking.map((item) => ({
    managerName: item.managerName,
    grossRevenue: item.totalGrossRevenue,
    sharePct: totalGrossRevenue > 0 ? (item.totalGrossRevenue / totalGrossRevenue) * 100 : 0,
  }));

  const last7dRange = dayRangeFromToday(7);
  const candidateRows = await listDailySettlements({
    startDate: last7dRange.startDate,
    endDate: last7dRange.endDate,
    limit: 8000,
  });
  const scaleByCreative = new Map<
    string,
    { grossRevenue7d: number; netProfit7d: number; managers: Set<string>; lastDate: string; daysReported: number }
  >();
  for (const row of candidateRows) {
    const key = row.winningCreativeId.trim() || "SEM_ID";
    const current =
      scaleByCreative.get(key) ?? {
        grossRevenue7d: 0,
        netProfit7d: 0,
        managers: new Set<string>(),
        lastDate: row.date,
        daysReported: 0,
      };
    current.grossRevenue7d += row.grossRevenue;
    current.netProfit7d += row.netProfit;
    current.managers.add(row.userName);
    current.daysReported += 1;
    if (row.date > current.lastDate) {
      current.lastDate = row.date;
    }
    scaleByCreative.set(key, current);
  }
  const scaleAlerts = [...scaleByCreative.entries()]
    .map(([winningCreativeId, values]) => ({
      winningCreativeId,
      grossRevenue7d: values.grossRevenue7d,
      netProfit7d: values.netProfit7d,
      managerNames: [...values.managers],
      daysReported: values.daysReported,
      lastDate: values.lastDate,
      eligibleScaleVertical: values.grossRevenue7d >= 70_000,
    }))
    .filter((item) => item.eligibleScaleVertical)
    .sort((a, b) => b.grossRevenue7d - a.grossRevenue7d)
    .slice(0, 12);

  const detailByManager = managerUserId
    ? records
        .filter((row) => row.userId === managerUserId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30)
    : [];

  return NextResponse.json(
    {
      cards: {
        netProfitGlobal: totalNetProfit,
        investmentGlobal: totalAdSpend,
        grossRevenueGlobal: totalGrossRevenue,
        roasMedioReal,
        efficiencyScore,
      },
      ranking,
      charts: {
        profitByNiche,
        profitByOffer,
        marketShareByManager,
      },
      scaleAlerts,
      detailByManager,
      filters: {
        preset,
        startDate,
        endDate,
        managerUserId: managerUserId ?? "",
        niche: niche ?? "",
        availableManagers: toUniqueArray(allRecordsForFilter.map((row) => row.userId)).map((userId) => {
          const row = allRecordsForFilter.find((item) => item.userId === userId);
          return {
            userId,
            managerName: row?.userName ?? userId,
          };
        }),
        availableNiches: toUniqueArray(allRecordsForFilter.map((row) => row.niche)),
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=0, stale-while-revalidate=900",
      },
    },
  );
}

