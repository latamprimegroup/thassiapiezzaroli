import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { appendPlaybookAction, listPlaybookActions } from "@/lib/persistence/lead-intelligence-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const actions = await listPlaybookActions(1000);
  return NextResponse.json({ actions });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => ({}))) as {
    leadId?: string;
    action?: "welcome_call" | "support_ticket" | "downsell_offer" | "vip_followup";
    note?: string;
  };

  const leadId = String(payload.leadId ?? "").trim();
  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatorio." }, { status: 400 });
  }
  const action =
    payload.action === "welcome_call" ||
    payload.action === "support_ticket" ||
    payload.action === "downsell_offer" ||
    payload.action === "vip_followup"
      ? payload.action
      : "support_ticket";
  const created = await appendPlaybookAction({
    leadId,
    action,
    note: String(payload.note ?? "").trim(),
    triggeredBy: `${session.userId}:${session.role}`,
  });
  return NextResponse.json({ ok: true, actionRecord: created });
}
