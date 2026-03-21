import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth/session";
import { approveMonthlyPayout, getMonthlyPayout } from "@/lib/bonus/bonus-service";
import { listBonusApprovals } from "@/lib/persistence/bonus-repository";

export const runtime = "nodejs";

const approvalSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  note: z.string().trim().max(400).optional(),
});

function canViewPayout(role: string) {
  return role === "ceo" || role === "financeManager" || role === "cfo";
}

function canApprove(role: string) {
  return role === "ceo";
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!canViewPayout(session.role)) {
    return NextResponse.json({ error: "Sem permissao para relatorio de payout." }, { status: 403 });
  }
  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month") ?? undefined;
  const managerUserId = url.searchParams.get("userId") ?? undefined;
  const niche = url.searchParams.get("niche") ?? undefined;
  const payout = await getMonthlyPayout({
    monthKey,
    managerUserId,
    niche,
  });
  const approvals = await listBonusApprovals(payout.monthKey);
  return NextResponse.json({
    monthKey: payout.monthKey,
    frozenSnapshot: payout.frozenSnapshot,
    summary: payout.summary,
    rows: payout.rows,
    approvals,
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!canApprove(session.role)) {
    return NextResponse.json({ error: "Somente CEO pode aprovar pagamento." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para aprovacao de payout.",
        detail: parsed.error.issues[0]?.message ?? "Dados obrigatorios ausentes.",
      },
      { status: 400 },
    );
  }
  const result = await approveMonthlyPayout({
    monthKey: parsed.data.monthKey,
    approvedBy: session.userId,
    note: parsed.data.note ?? "",
  });
  return NextResponse.json({
    ok: true,
    approval: result.approval,
    approvals: result.approvals,
  });
}

