import { NextResponse } from "next/server";
import { z } from "zod";
import { processFirstContactWebhook } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const payloadSchema = z.object({
  chatId: z.string().trim().min(1),
});

function isAuthorized(request: Request) {
  const expected = process.env.WAR_ROOM_WEBHOOK_API_KEY;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return apiKey === expected || bearer === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para webhook de contato.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  const updated = await processFirstContactWebhook({
    chatId: parsed.data.chatId,
    actorUserId: "system",
    actorUserName: "Webhook Contacted",
    actorRole: "system",
  });
  if (!updated) {
    return NextResponse.json({ error: "Chat nao encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, chat: updated });
}

