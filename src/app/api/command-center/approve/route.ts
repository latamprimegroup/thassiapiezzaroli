import { NextResponse } from "next/server";
import { canApproveDone, approveTaskForDone } from "@/lib/command-center/command-center-persistence";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getDemoUserById } from "@/lib/auth/users";
import type { WarRoomData } from "@/lib/war-room/types";

export const runtime = "nodejs";
type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }
  if (!canApproveDone(session.role)) {
    return NextResponse.json({ error: "Apenas Head de Midia ou CEO podem aprovar Done." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    note?: string;
    task?: DemandTask;
  };

  if (!payload.taskId) {
    return NextResponse.json({ error: "taskId obrigatorio." }, { status: 400 });
  }

  const approver = getDemoUserById(session.userId);
  const updated = await approveTaskForDone({
    taskId: payload.taskId,
    approverName: approver?.name ?? "Aprovador",
    approverRole: session.role,
    note: payload.note ?? "",
    fallbackTask: payload.task,
  });

  if (!updated) {
    return NextResponse.json({ error: "Tarefa nao encontrada no store persistente." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, task: updated });
}
