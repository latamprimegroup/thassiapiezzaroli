import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getRoutingStatus, switchRoute } from "@/lib/routing/traffic-router";

export const runtime = "nodejs";

function canManageRouting(role: string) {
  return [
    "ceo",
    "headTraffic",
    "trafficSenior",
    "mediaBuyer",
    "techAdmin",
    "ctoDev",
  ].includes(role);
}

function parseAllowedRoutingHosts() {
  return (process.env.WAR_ROOM_ROUTING_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function validateTargetUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "targetUrl invalido." } as const;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "Apenas URLs http/https sao permitidas." } as const;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Host local/interno nao permitido." } as const;
  }
  const allowlist = parseAllowedRoutingHosts();
  const allowInsecureDev = process.env.WAR_ROOM_ALLOW_INSECURE_DEV_ROUTING === "true" && process.env.NODE_ENV !== "production";
  if (allowlist.length === 0 && !allowInsecureDev) {
    return { ok: false, reason: "WAR_ROOM_ROUTING_ALLOWED_HOSTS nao configurado." } as const;
  }
  if (allowlist.length > 0) {
    const hostAllowed = allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    if (!hostAllowed) {
      return { ok: false, reason: "Host fora da allowlist de roteamento." } as const;
    }
  }
  return { ok: true, normalizedUrl: parsed.toString() } as const;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const rules = await getRoutingStatus();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!canManageRouting(session.role)) {
    return NextResponse.json({ error: "Sem permissao para trocar rotas." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    offerId?: string;
    targetUrl?: string;
    mode?: "primary" | "failover_manual" | "failover_auto";
    reason?: string;
  };
  const offerId = String(payload.offerId ?? "global").trim() || "global";
  const targetUrlRaw = String(payload.targetUrl ?? "").trim();
  if (!targetUrlRaw) {
    return NextResponse.json({ error: "targetUrl obrigatorio." }, { status: 400 });
  }
  const validatedTargetUrl = validateTargetUrl(targetUrlRaw);
  if (!validatedTargetUrl.ok) {
    return NextResponse.json({ error: validatedTargetUrl.reason }, { status: 400 });
  }
  const mode =
    payload.mode === "primary" || payload.mode === "failover_auto" || payload.mode === "failover_manual"
      ? payload.mode
      : "failover_manual";
  const updated = await switchRoute({
    offerId,
    targetUrl: validatedTargetUrl.normalizedUrl,
    mode,
    reason: String(payload.reason ?? "").trim() || `switch manual por ${session.role}`,
  });
  if (!updated) {
    return NextResponse.json({ error: "Rota nao encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rule: updated });
}
