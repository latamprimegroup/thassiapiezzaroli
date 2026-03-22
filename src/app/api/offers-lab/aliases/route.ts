import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { upsertUtmAlias, listUtmAliases } from "@/lib/offers/offers-lab-service";
import { captureServerError } from "@/lib/observability/error-monitoring";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  try {
    const items = await listUtmAliases();
    return NextResponse.json({ items });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/aliases",
      error,
      context: { method: "GET" },
    });
    return NextResponse.json({ error: "Falha ao listar aliases." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!["ceo", "headTraffic", "trafficSenior", "mediaBuyer", "financeManager", "cfo", "techAdmin", "ctoDev"].includes(session.role)) {
    return NextResponse.json({ error: "Sem permissao para cadastrar alias." }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const record = await upsertUtmAlias({
      rawSource: typeof body.rawSource === "string" ? body.rawSource : "",
      canonicalSource:
        body.canonicalSource === "meta" ||
        body.canonicalSource === "google" ||
        body.canonicalSource === "tiktok" ||
        body.canonicalSource === "kwai" ||
        body.canonicalSource === "networking"
          ? body.canonicalSource
          : "unknown",
      approvedBy: session.userId,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/aliases",
      error,
      context: { method: "POST" },
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao cadastrar alias.",
      },
      { status: 400 },
    );
  }
}

