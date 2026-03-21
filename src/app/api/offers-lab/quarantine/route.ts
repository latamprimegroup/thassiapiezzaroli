import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { listQuarantine } from "@/lib/offers/offers-lab-service";
import { captureServerError } from "@/lib/observability/error-monitoring";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!["ceo", "mediaBuyer", "financeManager", "copywriter"].includes(session.role)) {
    return NextResponse.json({ error: "Sem permissao para listar quarentena." }, { status: 403 });
  }
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const limitRaw = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 100;
    const items = await listQuarantine({
      status: statusParam === "open" || statusParam === "resolved" ? statusParam : undefined,
      limit,
    });
    return NextResponse.json({
      items,
      count: items.length,
    });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/quarantine",
      error,
      context: { method: "GET" },
    });
    return NextResponse.json({ error: "Falha ao listar quarentena." }, { status: 500 });
  }
}

