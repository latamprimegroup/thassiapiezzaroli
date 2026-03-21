import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { listSniperInstances } from "@/lib/persistence/sniper-crm-repository";
import { saveInstance } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const instanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(3).max(120),
  status: z.enum(["offline", "qr_pending", "connected", "syncing", "error"]),
  conversionGoalDaily: z.coerce.number().int().min(0).max(1000),
  conversionsToday: z.coerce.number().int().min(0).max(1000),
  qrCodeText: z.string().max(400).optional(),
});

export async function GET() {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const includeAll = auth.session.role === "ceo";
  const items = await listSniperInstances({
    ownerUserId: includeAll ? undefined : auth.session.userId,
    includeAll,
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = instanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para instancia.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const item = await saveInstance({
      session: auth.session,
      instance: parsed.data,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao salvar instancia.",
      },
      { status: 400 },
    );
  }
}

