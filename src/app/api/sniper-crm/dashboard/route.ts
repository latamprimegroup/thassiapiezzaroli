import { NextResponse } from "next/server";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { getSniperDashboard } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const awaitingResponseOnly = url.searchParams.get("filter") === "awaiting_response";
  const chatId = url.searchParams.get("chatId") ?? "";
  try {
    const dashboard = await getSniperDashboard({
      session: auth.session,
      search,
      awaitingResponseOnly,
      chatId: chatId || undefined,
    });
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao carregar dashboard do Sniper CRM.",
      },
      { status: 500 },
    );
  }
}

