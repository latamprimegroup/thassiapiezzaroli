import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getOffersLabDashboard, syncOffersFromUtmify } from "@/lib/offers/offers-lab-service";

export const runtime = "nodejs";

function isApiKeyAuthorized(request: Request) {
  const expected = process.env.OFFERS_LAB_API_KEY || process.env.WAR_ROOM_WEBHOOK_API_KEY;
  if (!expected) {
    return false;
  }
  const apiKey = request.headers.get("x-api-key");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return apiKey === expected || bearer === expected;
}

async function authorize(request: Request) {
  const session = await getSessionFromCookies();
  if (session && ["ceo", "mediaBuyer", "financeManager"].includes(session.role)) {
    return true;
  }
  return isApiKeyAuthorized(request);
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const result = await syncOffersFromUtmify();
  const dashboard = await getOffersLabDashboard();
  return NextResponse.json({
    ok: true,
    cronCadenceMinutes: 15,
    sync: result.state,
    syncedEvents: result.syncedEvents,
    validatedOffers: dashboard.validatedOffers.length,
  });
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const dashboard = await getOffersLabDashboard();
  return NextResponse.json({
    ok: true,
    sync: dashboard.sync,
    validatedOffers: dashboard.validatedOffers.length,
    note: "Agende POST /api/offers-lab/sync a cada 15 minutos no scheduler da sua infraestrutura.",
  });
}

