import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { dayRangeFromToday, toDateOnlyIso } from "@/lib/metrics/daily-settlement";
import { listDailySettlements, getDailySettlementByUserDate } from "@/lib/persistence/daily-settlement-repository";

export const runtime = "nodejs";

function sumNetProfit(values: Array<{ netProfit: number }>) {
  return values.reduce((acc, item) => acc + item.netProfit, 0);
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedUserId = String(url.searchParams.get("userId") ?? "").trim();
  const userId = session.role === "ceo" && requestedUserId ? requestedUserId : session.userId;

  const today = toDateOnlyIso(new Date());
  const yesterdayDateObj = new Date();
  yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
  const yesterday = toDateOnlyIso(yesterdayDateObj);
  const { startDate: weekStart } = dayRangeFromToday(7);
  const monthStart = `${today.slice(0, 8)}01`;
  const trendStart = dayRangeFromToday(30).startDate;

  const [weekRows, monthRows, trendRows, yesterdayRecord] = await Promise.all([
    listDailySettlements({ userId, startDate: weekStart, endDate: today, limit: 200 }),
    listDailySettlements({ userId, startDate: monthStart, endDate: today, limit: 600 }),
    listDailySettlements({ userId, startDate: trendStart, endDate: today, limit: 1000 }),
    getDailySettlementByUserDate(userId, yesterday),
  ]);

  const weeklyProfit = sumNetProfit(weekRows);
  const monthlyProfit = sumNetProfit(monthRows);
  const hasPendingYesterday = !yesterdayRecord;

  const trend = trendRows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      date: item.date,
      adSpend: item.adSpend,
      grossRevenue: item.grossRevenue,
      netProfit: item.netProfit,
    }));

  return NextResponse.json({
    userId,
    pendingStatus: {
      date: yesterday,
      hasRecord: !hasPendingYesterday,
    },
    weeklyProfit,
    monthlyProfit,
    trend,
  });
}

