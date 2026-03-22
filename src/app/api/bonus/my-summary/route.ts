import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getMyBonusSummary } from "@/lib/bonus/bonus-service";

export const runtime = "nodejs";

const BONUS_ALLOWED_ROLES = new Set([
  "ceo",
  "trafficJunior",
  "trafficSenior",
  "mediaBuyer",
  "headTraffic",
]);

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!BONUS_ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Perfil sem acesso ao modulo de bonificacao." }, { status: 403 });
  }
  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month") ?? undefined;
  const summary = await getMyBonusSummary({
    userId: session.userId,
    monthKey,
  });
  return NextResponse.json(summary);
}

