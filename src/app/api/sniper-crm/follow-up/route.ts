import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { scheduleFollowUp } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const followUpSchema = z.object({
  chatId: z.string().trim().min(1),
  text: z.string().trim().min(3).max(4000),
  followUpAt: z.string().trim().min(10),
});

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = followUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para agendamento de follow-up.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const queueItem = await scheduleFollowUp({
      session: auth.session,
      chatId: parsed.data.chatId,
      text: parsed.data.text,
      followUpAt: parsed.data.followUpAt,
    });
    return NextResponse.json({ ok: true, queueItem });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao agendar follow-up.",
      },
      { status: 400 },
    );
  }
}

