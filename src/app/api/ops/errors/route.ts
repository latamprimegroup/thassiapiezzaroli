import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { captureServerError } from "@/lib/observability/error-monitoring";
import { listSilentErrors } from "@/lib/observability/error-monitoring-store";
import { checkRateLimit, readRequestIp } from "@/lib/security/rate-limit";

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

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  const allowedBySession = Boolean(session);
  if (!allowedBySession && !isApiKeyAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const ip = readRequestIp(request);
  const limit = await checkRateLimit({
    key: `ops-errors:${ip}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit excedido." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  await captureServerError({
    route: typeof body.route === "string" ? body.route : "/client",
    error: typeof body.message === "string" ? body.message : "Client-side error report",
    context: {
      stack: typeof body.stack === "string" ? body.stack.slice(0, 4_000) : "",
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
      userAgent: request.headers.get("user-agent") ?? "",
    },
    level:
      body.level === "warning" || body.level === "critical" || body.level === "error"
        ? body.level
        : "error",
  });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  const allowedByRole = session && (session.role === "ceo" || session.role === "financeManager");
  if (!allowedByRole && !isApiKeyAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;
  const items = await listSilentErrors(limit);
  return NextResponse.json({
    items,
    count: items.length,
  });
}

