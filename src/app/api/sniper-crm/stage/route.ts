import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { moveChatStage } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const stageSchema = z.object({
  chatId: z.string().trim().min(1),
  stage: z.enum(["lead", "contato", "boleto_pix_gerado", "vendido"]),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
  grossRevenue: z.coerce.number().finite().min(0).optional(),
});

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para atualizacao de stage.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const chat = await moveChatStage({
      session: auth.session,
      chatId: parsed.data.chatId,
      stage: parsed.data.stage,
      priority: parsed.data.priority,
      grossRevenue: parsed.data.grossRevenue,
    });
    return NextResponse.json({ ok: true, chat });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao mover stage do lead.",
      },
      { status: 400 },
    );
  }
}

