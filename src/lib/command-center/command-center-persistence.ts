import type { UserRole } from "@/lib/auth/rbac";
import type { WarRoomData } from "@/lib/war-room/types";
import {
  appendTaskApproval,
  readPersistedCommandCenterTasks,
  type TaskApprovalRecord,
  writePersistedCommandCenterTasks,
} from "@/lib/persistence/war-room-ops-store";

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

export function canApproveDone(role: UserRole) {
  return role === "ceo" || role === "mediaBuyer";
}

export async function mergeCommandCenterFromStore(data: WarRoomData): Promise<WarRoomData> {
  const persisted = await readPersistedCommandCenterTasks();
  if (persisted.length === 0) {
    return data;
  }
  const next = structuredClone(data);
  next.commandCenter.tasks = persisted;
  return next;
}

export async function persistCommandCenterTasks(tasks: DemandTask[]) {
  return writePersistedCommandCenterTasks(tasks);
}

export async function approveTaskForDone(params: {
  taskId: string;
  approverName: string;
  approverRole: UserRole;
  note: string;
  fallbackTask?: DemandTask;
}) {
  const existing = await readPersistedCommandCenterTasks();
  const tasks =
    existing.length > 0
      ? [...existing]
      : params.fallbackTask
        ? [params.fallbackTask]
        : [];
  const index = tasks.findIndex((task) => task.id === params.taskId);
  if (index < 0) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const target = tasks[index];
  const updated: DemandTask = {
    ...target,
    doneApproval: {
      required: target.department === "editorsCreative" ? true : (target.doneApproval?.required ?? false),
      approved: true,
      approvedBy: params.approverName,
      approvedRole: params.approverRole,
      approvedAt: nowIso,
      note: params.note,
    },
    decisionLog: [
      ...target.decisionLog,
      {
        at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        author: params.approverName,
        note: `Aprovacao de qualidade para Done: ${params.note || "sem observacoes"}.`,
      },
    ],
  };
  tasks[index] = updated;
  await writePersistedCommandCenterTasks(tasks);
  const approvalRecord: TaskApprovalRecord = {
    taskId: params.taskId,
    approvedBy: params.approverName,
    approvedRole: params.approverRole,
    approvedAt: nowIso,
    note: params.note,
  };
  await appendTaskApproval(approvalRecord);
  return updated;
}
