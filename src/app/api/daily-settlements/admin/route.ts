import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { dayRangeFromToday, toDateOnlyIso } from "@/lib/metrics/daily-settlement";
import { listDailySettlements } from "@/lib/persistence/daily-settlement-repository";

export const runtime = "nodejs";

const ADMIN_ROLES = new Set(["ceo", "financeManager", "cfo"]);

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Sem permissao para visao admin do Daily Settlement." }, { status: 403 });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate") ?? dayRangeFromToday(30).startDate;
  const endDate = url.searchParams.get("endDate") ?? toDateOnlyIso(new Date());
  const managerUserId = String(url.searchParams.get("managerUserId") ?? "").trim() || undefined;
  const niche = String(url.searchParams.get("niche") ?? "").trim() || undefined;

  const records = await listDailySettlements({
    userId: managerUserId,
    niche,
    startDate,
    endDate,
    limit: 2000,
  });

  const managerMap = new Map<
    string,
    {
      userId: string;
      userName: string;
      totalNetProfit: number;
      totalGrossRevenue: number;
      totalAdSpend: number;
      daysReported: number;
      topNiche: string;
    }
  >();
  const nicheMap = new Map<
    string,
    {
      niche: string;
      totalNetProfit: number;
      totalGrossRevenue: number;
      totalAdSpend: number;
      daysReported: number;
    }
  >();
  const managerNicheCounter = new Map<string, Map<string, number>>();

  for (const row of records) {
    const managerKey = row.userId;
    const managerCurrent =
      managerMap.get(managerKey) ??
      ({
        userId: row.userId,
        userName: row.userName,
        totalNetProfit: 0,
        totalGrossRevenue: 0,
        totalAdSpend: 0,
        daysReported: 0,
        topNiche: row.niche,
      } as const);
    managerMap.set(managerKey, {
      ...managerCurrent,
      totalNetProfit: managerCurrent.totalNetProfit + row.netProfit,
      totalGrossRevenue: managerCurrent.totalGrossRevenue + row.grossRevenue,
      totalAdSpend: managerCurrent.totalAdSpend + row.adSpend,
      daysReported: managerCurrent.daysReported + 1,
    });

    const nicheCurrent =
      nicheMap.get(row.niche) ??
      ({
        niche: row.niche,
        totalNetProfit: 0,
        totalGrossRevenue: 0,
        totalAdSpend: 0,
        daysReported: 0,
      } as const);
    nicheMap.set(row.niche, {
      ...nicheCurrent,
      totalNetProfit: nicheCurrent.totalNetProfit + row.netProfit,
      totalGrossRevenue: nicheCurrent.totalGrossRevenue + row.grossRevenue,
      totalAdSpend: nicheCurrent.totalAdSpend + row.adSpend,
      daysReported: nicheCurrent.daysReported + 1,
    });

    const nicheCounter = managerNicheCounter.get(managerKey) ?? new Map<string, number>();
    nicheCounter.set(row.niche, (nicheCounter.get(row.niche) ?? 0) + 1);
    managerNicheCounter.set(managerKey, nicheCounter);
  }

  const managers = [...managerMap.values()]
    .map((item) => {
      const nicheCounter = managerNicheCounter.get(item.userId) ?? new Map<string, number>();
      const topNiche =
        [...nicheCounter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        item.topNiche;
      return {
        ...item,
        topNiche,
        avgNetPerDay: item.daysReported > 0 ? item.totalNetProfit / item.daysReported : 0,
      };
    })
    .sort((a, b) => b.totalNetProfit - a.totalNetProfit);

  const niches = [...nicheMap.values()].sort((a, b) => b.totalNetProfit - a.totalNetProfit);

  return NextResponse.json({
    filters: {
      startDate,
      endDate,
      managerUserId: managerUserId ?? "",
      niche: niche ?? "",
    },
    managers,
    niches,
    records: records.slice(0, 500),
  });
}

