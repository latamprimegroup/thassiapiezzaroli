import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getOffersLabDashboard, upsertOffer } from "@/lib/offers/offers-lab-service";
import { captureServerError } from "@/lib/observability/error-monitoring";

export const runtime = "nodejs";

function toBoolean(value: string | null) {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const niche = url.searchParams.get("niche") || undefined;
    const ownerId = url.searchParams.get("ownerId") || undefined;
    const minRoasRaw = url.searchParams.get("minRoas");
    const minRoas = minRoasRaw ? Number(minRoasRaw) : undefined;
    const validatedOnly = toBoolean(url.searchParams.get("validatedOnly"));

    const dashboard = await getOffersLabDashboard({
      niche,
      ownerId,
      minRoas: Number.isFinite(minRoas) ? minRoas : undefined,
      validatedOnly,
    });
    const filterOptions = {
      niches: [...new Set(dashboard.offers.map((offer) => offer.niche))].filter(Boolean),
      owners: [...new Set(dashboard.offers.map((offer) => offer.ownerId))].filter(Boolean),
    };
    return NextResponse.json(
      {
        data: dashboard,
        filters: filterOptions,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab",
      error,
      context: {
        method: "GET",
      },
    });
    return NextResponse.json({ error: "Falha ao carregar dashboard do Offers Lab." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!["ceo", "mediaBuyer", "copywriter", "financeManager"].includes(session.role)) {
    return NextResponse.json({ error: "Sem permissao para alterar Offers Lab." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const offer = await upsertOffer({
      id: typeof body.id === "string" ? body.id : undefined,
      name: typeof body.name === "string" ? body.name : "",
      status:
        body.status === "teste" || body.status === "validada" || body.status === "escala" || body.status === "arquivada"
          ? body.status
          : undefined,
      niche: typeof body.niche === "string" ? body.niche : undefined,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
      minRoasTarget: typeof body.minRoasTarget === "number" ? body.minRoasTarget : Number(body.minRoasTarget),
      trafficSource: typeof body.trafficSource === "string" ? body.trafficSource : undefined,
      utmBroughtBy: typeof body.utmBroughtBy === "string" ? body.utmBroughtBy : undefined,
      bigIdea: typeof body.bigIdea === "string" ? body.bigIdea : undefined,
      uniqueMechanism: typeof body.uniqueMechanism === "string" ? body.uniqueMechanism : undefined,
      sophisticationLevel:
        typeof body.sophisticationLevel === "number" ? body.sophisticationLevel : Number(body.sophisticationLevel),
      hookVariations: Array.isArray(body.hookVariations) ? body.hookVariations.map((item) => String(item)) : undefined,
    });
    return NextResponse.json({ ok: true, offer });
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab",
      error,
      context: {
        method: "POST",
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar oferta." },
      { status: 400 },
    );
  }
}

