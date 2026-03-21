import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth/session";
import { persistCommandCenterTasks } from "@/lib/command-center/command-center-persistence";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";
import type { WarRoomData } from "@/lib/war-room/types";

export const runtime = "nodejs";

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

const demandTaskSchema = z.object({
  id: z.string().trim().min(1),
  department: z.enum(["copyResearch", "trafficMedia", "editorsCreative", "techCro"]),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(5000),
  squadHead: z.string().trim().min(1).max(120),
  assignee: z.string().trim().min(1).max(120),
  status: z.enum(["backlog", "doing", "review", "done"]),
  impact: z.enum(["low", "medium", "high", "critical"]),
  createdAt: z.string().trim().min(1),
  lastMovedAt: z.string().trim().min(1),
  dueAt: z.string().trim().min(1),
  dependencyIds: z.array(z.string()).max(100),
  doneApproval: z.object({
    required: z.boolean(),
    approved: z.boolean(),
    approvedBy: z.string(),
    approvedRole: z.string(),
    approvedAt: z.string(),
    note: z.string(),
  }),
  decisionLog: z
    .array(
      z.object({
        at: z.string().trim().min(1),
        author: z.string().trim().min(1).max(120),
        note: z.string().trim().min(1).max(2000),
      }),
    )
    .max(500),
});

const tasksPayloadSchema = z.object({
  tasks: z.array(demandTaskSchema).min(1).max(5000),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }
  const data = await getWarRoomData();
  return NextResponse.json({ tasks: data.commandCenter.tasks });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as unknown;
  const parsed = tasksPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload de tarefas invalido.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos para tarefas.",
      },
      { status: 400 },
    );
  }
  const tasks: DemandTask[] = parsed.data.tasks;

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
