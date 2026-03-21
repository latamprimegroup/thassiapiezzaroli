import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { appendDailyTask, listDailyTasks } from "@/lib/persistence/daily-task-store";
import { getDemoUserById } from "@/lib/auth/users";

export const runtime = "nodejs";

const DAILY_TASK_ADMIN_ROLES = new Set(["ceo", "techAdmin", "ctoDev", "financeManager", "cfo"]);

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const records = await listDailyTasks(120);
  const visibleRecords = DAILY_TASK_ADMIN_ROLES.has(session.role)
    ? records
    : records.filter((record) => record.userId === session.userId);
  return NextResponse.json({ records: visibleRecords });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    summary?: string;
    blockers?: string;
    impactNote?: string;
  };
  const summary = String(body.summary ?? "").trim();
  if (!summary) {
    return NextResponse.json({ error: "Resumo da daily task e obrigatorio." }, { status: 400 });
  }
  const demoUser = getDemoUserById(session.userId);
  const created = await appendDailyTask({
    userId: session.userId,
    userName: demoUser?.name ?? session.userId,
    role: session.role,
    summary,
    blockers: String(body.blockers ?? "").trim(),
    impactNote: String(body.impactNote ?? "").trim(),
  });
  return NextResponse.json({ ok: true, record: created });
}
