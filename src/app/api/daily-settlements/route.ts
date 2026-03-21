import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getDemoUserById } from "@/lib/auth/users";
import { dayRangeFromToday, toDateOnlyIso } from "@/lib/metrics/daily-settlement";
import { listDailySettlements, upsertDailySettlement } from "@/lib/persistence/daily-settlement-repository";
import type { UserRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

const TRAFFIC_INPUT_ROLES: UserRole[] = ["ceo", "trafficJunior", "trafficSenior", "headTraffic", "mediaBuyer"];
const FEEDBACK_ROLES: UserRole[] = [
  "ceo",
  "trafficJunior",
  "trafficSenior",
  "headTraffic",
  "mediaBuyer",
  "copyJunior",
  "copySenior",
  "copywriter",
  "cco",
  "productionEditor",
  "productionDesigner",
];

const settlementInputSchema = z.object({
  date: z.string().optional(),
  niche: z.string().trim().min(2).max(120),
  adSpend: z.coerce.number().finite().min(0),
  salesCount: z.coerce.number().int().min(0),
  grossRevenue: z.coerce.number().finite().min(0),
  ctr: z.coerce.number().finite().min(0),
  cpc: z.coerce.number().finite().min(0),
  cpm: z.coerce.number().finite().min(0),
  checkoutRate: z.coerce.number().finite().min(0),
  winningCreativeId: z.string().trim().min(1).max(120),
  audienceInsight: z.string().trim().min(8).max(3000),
  productionFeedback: z.string().trim().min(8).max(3000),
});

type DeliveryStatus = "idle" | "sent" | "simulated" | "failed";

async function deliverToWebhook(url: string | undefined, payload: unknown): Promise<DeliveryStatus> {
  if (!url) {
    return "simulated";
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function dispatchFeedbackNotifications(params: {
  managerName: string;
  date: string;
  niche: string;
  winningCreativeId: string;
  audienceInsight: string;
  productionFeedback: string;
}) {
  const copyMessage = [
    "DAILY SETTLEMENT - FEEDBACK COPY",
    `Gestor: ${params.managerName}`,
    `Data: ${params.date}`,
    `Nicho: ${params.niche}`,
    `Criativo winner: ${params.winningCreativeId}`,
    `Audience insight: ${params.audienceInsight}`,
  ].join(" | ");
  const editingMessage = [
    "DAILY SETTLEMENT - FEEDBACK EDICAO",
    `Gestor: ${params.managerName}`,
    `Data: ${params.date}`,
    `Nicho: ${params.niche}`,
    `Winner: ${params.winningCreativeId}`,
    `Feedback de producao: ${params.productionFeedback}`,
  ].join(" | ");

  const [copySlack, copyWhatsapp, editSlack, editWhatsapp] = await Promise.all([
    deliverToWebhook(process.env.SLACK_WEBHOOK_URL, { text: copyMessage }),
    deliverToWebhook(process.env.WHATSAPP_WEBHOOK_URL, { message: copyMessage }),
    deliverToWebhook(process.env.SLACK_WEBHOOK_URL, { text: editingMessage }),
    deliverToWebhook(process.env.WHATSAPP_WEBHOOK_URL, { message: editingMessage }),
  ]);

  return {
    copy: {
      slack: copySlack,
      whatsapp: copyWhatsapp,
    },
    editing: {
      slack: editSlack,
      whatsapp: editWhatsapp,
    },
  };
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "records";
  const limitRaw = Number(url.searchParams.get("limit") ?? 120);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 120;

  if (mode === "feedback") {
    if (!FEEDBACK_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Sem permissao para feedback intersetorial." }, { status: 403 });
    }
    const team = url.searchParams.get("team") === "editing" ? "editing" : "copy";
    const { startDate } = dayRangeFromToday(15);
    const rows = await listDailySettlements({
      startDate,
      limit: 400,
    });
    const items = rows
      .slice(0, 200)
      .map((row) => ({
        id: row.id,
        date: row.date,
        managerName: row.userName,
        niche: row.niche,
        winningCreativeId: row.winningCreativeId,
        audienceInsight: row.audienceInsight,
        productionFeedback: row.productionFeedback,
        netProfit: row.netProfit,
      }))
      .filter((row) => (team === "copy" ? row.audienceInsight.length > 0 : row.productionFeedback.length > 0))
      .slice(0, limit);
    return NextResponse.json({ team, items });
  }

  const scope = url.searchParams.get("scope") ?? "me";
  const requestedUserId = String(url.searchParams.get("userId") ?? "").trim();
  const isCeo = session.role === "ceo";
  const userId = scope === "all" && isCeo ? undefined : requestedUserId && isCeo ? requestedUserId : session.userId;
  const startDate = url.searchParams.get("startDate") ?? undefined;
  const endDate = url.searchParams.get("endDate") ?? undefined;
  const niche = url.searchParams.get("niche") ?? undefined;

  const records = await listDailySettlements({
    userId,
    startDate,
    endDate,
    niche,
    limit,
  });
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!TRAFFIC_INPUT_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Perfil sem permissao para Daily Settlement." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = settlementInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para fechamento diario.",
        detail: parsed.error.issues[0]?.message ?? "Campos obrigatorios ausentes.",
      },
      { status: 400 },
    );
  }

  const demoUser = getDemoUserById(session.userId);
  const settlement = await upsertDailySettlement({
    userId: session.userId,
    userName: demoUser?.name ?? session.userId,
    userRole: session.role,
    date: toDateOnlyIso(parsed.data.date ?? new Date()),
    niche: parsed.data.niche,
    adSpend: parsed.data.adSpend,
    salesCount: parsed.data.salesCount,
    grossRevenue: parsed.data.grossRevenue,
    ctr: parsed.data.ctr,
    cpc: parsed.data.cpc,
    cpm: parsed.data.cpm,
    checkoutRate: parsed.data.checkoutRate,
    winningCreativeId: parsed.data.winningCreativeId,
    audienceInsight: parsed.data.audienceInsight,
    productionFeedback: parsed.data.productionFeedback,
  });

  const notifications = await dispatchFeedbackNotifications({
    managerName: settlement.userName,
    date: settlement.date,
    niche: settlement.niche,
    winningCreativeId: settlement.winningCreativeId,
    audienceInsight: settlement.audienceInsight,
    productionFeedback: settlement.productionFeedback,
  });

  return NextResponse.json({
    ok: true,
    settlement,
    notifications,
  });
}

