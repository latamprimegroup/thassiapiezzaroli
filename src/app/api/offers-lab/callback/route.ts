import { NextResponse } from "next/server";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { registerTrafficEvent, registerTrafficEventsBatch } from "@/lib/offers/offers-lab-service";
import { captureServerError } from "@/lib/observability/error-monitoring";
import { checkRateLimit, readRequestIp } from "@/lib/security/rate-limit";
import { secureEquals } from "@/lib/security/secure-compare";
import { assertProductionReadinessIfRequired } from "@/lib/runtime/go-live-readiness";
import { normalizeOffersLabCallbackPayload } from "@/lib/validation/ingress-schemas";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = process.env.OFFERS_LAB_API_KEY || process.env.WAR_ROOM_WEBHOOK_API_KEY;
  const allowInsecureDev =
    process.env.WAR_ROOM_ALLOW_INSECURE_DEV_WEBHOOKS === "true" && process.env.NODE_ENV !== "production";
  if (!expected) {
    return allowInsecureDev;
  }
  const apiKey = request.headers.get("x-api-key")?.trim();
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return secureEquals(apiKey, expected) || secureEquals(bearer, expected);
}

export async function POST(request: Request) {
  await assertProductionReadinessIfRequired("/api/offers-lab/callback");
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const ip = readRequestIp(request);
  const limiter = await checkRateLimit({
    key: `offers-lab-callback:${ip}`,
    limit: WAR_ROOM_OPS_CONSTANTS.offersLab.callbackRateLimitPerMinute,
    windowMs: 60_000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit excedido para callback Offers Lab.",
        retryAfterMs: Math.max(0, limiter.resetMs - Date.now()),
      },
      { status: 429 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > 0 &&
    contentLength > WAR_ROOM_OPS_CONSTANTS.offersLab.callbackMaxPayloadBytes
  ) {
    return NextResponse.json(
      { error: "Payload excede limite permitido para callback Offers Lab." },
      { status: 413 },
    );
  }

  const parsed = (await request.json().catch(() => ({}))) as unknown;
  const normalizedPayload = normalizeOffersLabCallbackPayload(parsed);
  if (!normalizedPayload.ok) {
    return NextResponse.json(
      {
        error: "Payload malformado para callback Offers Lab.",
        detail: normalizedPayload.message,
      },
      { status: 400 },
    );
  }

  try {
    const eventArray = normalizedPayload.events;

    if (eventArray.length > 0) {
      const events = eventArray.slice(0, WAR_ROOM_OPS_CONSTANTS.offersLab.maxBatchEventsPerRequest);
      const result = await registerTrafficEventsBatch(events);
      return NextResponse.json({
        ok: true,
        mode: "batch",
        attempted: events.length,
        created: result.created,
        duplicates: result.duplicates,
        failed: result.failed,
        failures: result.failures.slice(0, 10),
      });
    }

    if (!normalizedPayload.single) {
      return NextResponse.json({ error: "Payload de evento unico ausente." }, { status: 400 });
    }
    const event = await registerTrafficEvent(normalizedPayload.single);
    return NextResponse.json({
      ok: true,
      mode: "single",
      eventId: event.id,
      offerId: event.offerId,
      trafficSource: event.trafficSource,
      gateway: event.gateway,
    });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/callback",
      error,
      context: {
        ip,
        hasEventsArray: normalizedPayload.events.length > 0,
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao processar callback." },
      { status: 400 },
    );
  }
}

