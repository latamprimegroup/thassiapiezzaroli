import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getOffersLabDashboard, trainPredictiveLtvModel } from "@/lib/offers/offers-lab-service";
import { captureServerError } from "@/lib/observability/error-monitoring";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  try {
    const dashboard = await getOffersLabDashboard();
    return NextResponse.json({
      predictiveLtv: dashboard.predictiveLtv,
    });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/ltv",
      error,
      context: { method: "GET" },
    });
    return NextResponse.json({ error: "Falha ao obter status do modelo LTV." }, { status: 500 });
  }
}

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!["ceo", "financeManager", "mediaBuyer"].includes(session.role)) {
    return NextResponse.json({ error: "Sem permissao para treinar modelo." }, { status: 403 });
  }
  try {
    const model = await trainPredictiveLtvModel();
    return NextResponse.json({
      ok: true,
      model,
    });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/ltv",
      error,
      context: { method: "POST" },
    });
    return NextResponse.json({ error: "Falha ao treinar modelo LTV." }, { status: 500 });
  }
}

