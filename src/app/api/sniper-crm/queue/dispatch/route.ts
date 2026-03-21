import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { dispatchSniperQueue } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const dispatchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = dispatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para dispatch.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const result = await dispatchSniperQueue({
      session: auth.session,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao processar fila.",
      },
      { status: 400 },
    );
  }
}

