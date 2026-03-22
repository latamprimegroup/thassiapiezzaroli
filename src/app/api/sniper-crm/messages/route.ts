import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { sendChatMessage } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const messageSchema = z.object({
  chatId: z.string().trim().min(1),
  text: z.string().max(4000).optional(),
  mediaUrl: z.string().url().optional(),
  quickCommand: z.string().max(60).optional(),
  direction: z.enum(["inbound", "outbound"]),
  kind: z.enum(["text", "audio", "video", "image", "state"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para mensagem.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const message = await sendChatMessage({
      session: auth.session,
      chatId: parsed.data.chatId,
      text: parsed.data.text,
      mediaUrl: parsed.data.mediaUrl,
      quickCommand: parsed.data.quickCommand,
      direction: parsed.data.direction,
      kind: parsed.data.kind,
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao enviar mensagem.",
      },
      { status: 400 },
    );
  }
}

