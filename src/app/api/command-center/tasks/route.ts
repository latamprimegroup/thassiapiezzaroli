import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { persistCommandCenterTasks } from "@/lib/command-center/command-center-persistence";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";
import type { WarRoomData } from "@/lib/war-room/types";

export const runtime = "nodejs";

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }
  const data = await getWarRoomData();
  return NextResponse.json({ tasks: data.commandCenter.tasks });
}

function sanitizeTasks(tasks: unknown): DemandTask[] {
  if (!Array.isArray(tasks)) {
    return [];
  }
  return tasks.filter((task) => typeof task === "object" && task !== null) as DemandTask[];
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { tasks?: unknown };
  const tasks = sanitizeTasks(payload.tasks);
  if (tasks.length === 0) {
    return NextResponse.json({ error: "Payload de tarefas invalido." }, { status: 400 });
  }

  const invalidDone = tasks.find(
    (task) =>
      task.department === "editorsCreative" &&
      task.status === "done" &&
      task.doneApproval?.required &&
      !task.doneApproval?.approved,
  );
  if (invalidDone) {
    return NextResponse.json(
      { error: `Tarefa ${invalidDone.id} nao pode ir para Done sem aprovacao de Midia/CEO.` },
      { status: 400 },
    );
  }

  await persistCommandCenterTasks(tasks);
  return NextResponse.json({ ok: true, count: tasks.length });
}
