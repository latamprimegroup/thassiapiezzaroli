import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { appendSniperAuditLog, getSniperChatById, setSniperChatAutomationState } from "@/lib/persistence/sniper-crm-repository";
import { getDemoUserById } from "@/lib/auth/users";

export const runtime = "nodejs";

const automationSchema = z.object({
  chatId: z.string().trim().min(1),
  paused: z.boolean(),
  reason: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = automationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para automacao.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  const chat = await getSniperChatById(parsed.data.chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat nao encontrado." }, { status: 404 });
  }
  const includeAll = auth.session.role === "ceo";
  if (!includeAll && chat.ownerUserId !== auth.session.userId) {
    return NextResponse.json({ error: "Nao autorizado para este chat." }, { status: 403 });
  }
  const updated = await setSniperChatAutomationState({
    chatId: parsed.data.chatId,
    paused: parsed.data.paused,
    reason: parsed.data.reason || "",
  });
  const user = getDemoUserById(auth.session.userId);
  await appendSniperAuditLog({
    chatId: parsed.data.chatId,
    actorUserId: auth.session.userId,
    actorUserName: user?.name ?? auth.session.userId,
    actorRole: auth.session.role,
    eventType: parsed.data.paused ? "automation_paused" : "automation_resumed",
    note: parsed.data.paused ? `Automacao pausada: ${parsed.data.reason ?? "manual"}` : "Automacao retomada manualmente.",
  });
  return NextResponse.json({ ok: true, chat: updated });
}

