import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getBonusSettings, updateBonusSettings } from "@/lib/bonus/bonus-service";

export const runtime = "nodejs";

const managerRuleSchema = z.object({
  userId: z.string().trim().min(1),
  userName: z.string().trim().min(1).max(120),
  commissionPct: z.coerce.number().finite().min(0).max(100),
  active: z.boolean().default(true),
});

const ladderRuleSchema = z.object({
  id: z.string().trim().min(1).max(80),
  minNetProfit: z.coerce.number().finite().min(0),
  commissionPct: z.coerce.number().finite().min(0).max(100),
  bonusFixed: z.coerce.number().finite().min(0),
});

const settingsPayloadSchema = z.object({
  managerRules: z.array(managerRuleSchema).max(500).optional(),
  ladderRules: z.array(ladderRuleSchema).min(1).max(20).optional(),
});

function isCeo(role: string) {
  return role === "ceo";
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!isCeo(session.role)) {
    return NextResponse.json({ error: "Somente CEO pode visualizar regras de comissao." }, { status: 403 });
  }
  const settings = await getBonusSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!isCeo(session.role)) {
    return NextResponse.json({ error: "Somente CEO pode alterar regras de comissao." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = settingsPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para configuracao de comissionamento.",
        detail: parsed.error.issues[0]?.message ?? "Dados insuficientes.",
      },
      { status: 400 },
    );
  }
  const settings = await updateBonusSettings({
    managerRules: parsed.data.managerRules,
    ladderRules: parsed.data.ladderRules,
    updatedBy: session.userId,
  });
  return NextResponse.json({ ok: true, settings });
}

