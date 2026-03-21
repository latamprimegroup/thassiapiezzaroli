import { NextResponse } from "next/server";
import { registerTrafficEvent } from "@/lib/offers/offers-lab-service";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = process.env.OFFERS_LAB_API_KEY || process.env.WAR_ROOM_WEBHOOK_API_KEY;
  if (!expected) {
    return true;
  }
  const apiKey = request.headers.get("x-api-key");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return apiKey === expected || bearer === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const event = await registerTrafficEvent(payload);
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      offerId: event.offerId,
      trafficSource: event.trafficSource,
      gateway: event.gateway,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao processar callback." },
      { status: 400 },
    );
  }
}

