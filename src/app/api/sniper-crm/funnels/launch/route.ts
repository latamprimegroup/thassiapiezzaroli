import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { launchFunnelForChat } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const launchSchema = z.object({
  chatId: z.string().trim().min(1),
  funnelId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = launchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para disparo de funil.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const payload = await launchFunnelForChat({
      session: auth.session,
      chatId: parsed.data.chatId,
      funnelId: parsed.data.funnelId,
    });
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao disparar funil.",
      },
      { status: 400 },
    );
  }
}

