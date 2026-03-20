"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";
import { isFatigueImminent } from "@/lib/metrics/kpis";
import { computeIntelligenceEngine } from "@/lib/metrics/intelligence-engine";
import type { DemandDepartment, DemandStatus, FinancialImpact, WarRoomData } from "@/lib/war-room/types";
import type { UserRole } from "@/lib/auth/rbac";

type CommandCenterModuleProps = {
  actorName: string;
  actorRole: UserRole;
};

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

const DEPARTMENTS: Array<{ id: DemandDepartment; label: string; headLabel: string }> = [
  { id: "copyResearch", label: "Copy / Research", headLabel: "Head Copy" },
  { id: "trafficMedia", label: "Midia / Trafego", headLabel: "Head Midia" },
  { id: "editorsCreative", label: "Edicao / Criativos", headLabel: "Head Edicao" },
  { id: "techCro", label: "Tech / CRO", headLabel: "Head Tech" },
];

const COLUMNS: Array<{ id: DemandStatus; label: string }> = [
  { id: "backlog", label: "Backlog" },
  { id: "doing", label: "Doing" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const IMPACT_OPTIONS: Array<{ id: FinancialImpact; label: string }> = [
  { id: "low", label: "Baixo" },
  { id: "medium", label: "Medio" },
  { id: "high", label: "Alto" },
  { id: "critical", label: "Critico" },
];

const IMPACT_RANK: Record<FinancialImpact, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function toShortTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }
  return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function impactBadgeVariant(impact: FinancialImpact) {
  if (impact === "critical") {
    return "danger";
  }
  if (impact === "high") {
    return "warning";
  }
  if (impact === "medium") {
    return "sky";
  }
  return "default";
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "??";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getSlaCountdown(task: DemandTask, nowMs: number) {
  if (task.impact !== "critical" || task.status === "done") {
    return null;
  }
  const dueMs = new Date(task.dueAt).getTime();
  if (!Number.isFinite(dueMs)) {
    return "SLA invalido";
  }
  const diff = dueMs - nowMs;
  if (diff <= 0) {
    return "SLA estourado";
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function sortByPriority(a: DemandTask, b: DemandTask) {
  const impactDiff = IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
  if (impactDiff !== 0) {
    return impactDiff;
  }
  const aDue = new Date(a.dueAt).getTime();
  const bDue = new Date(b.dueAt).getTime();
  if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) {
    return aDue - bDue;
  }
  return b.createdAt.localeCompare(a.createdAt);
}

export function CommandCenterModule({ actorName, actorRole }: CommandCenterModuleProps) {
  const { data, addActivity } = useWarRoom();
  const [tasks, setTasks] = useState<DemandTask[]>(data.commandCenter.tasks);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, string>>({});
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const canApproveDone = actorRole === "ceo" || actorRole === "mediaBuyer";

  const fatigueWinners = useMemo(
    () => data.liveAdsTracking.filter((row) => row.roas > 2.5 && isFatigueImminent(row)),
    [data.liveAdsTracking],
  );
  const [selectedFatigueCreativeId, setSelectedFatigueCreativeId] = useState(fatigueWinners[0]?.id ?? "");
  const effectiveSelectedFatigueCreativeId = selectedFatigueCreativeId || fatigueWinners[0]?.id || "";
  const intelligence = useMemo(() => computeIntelligenceEngine(data), [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch("/api/command-center/tasks", { cache: "no-store" });
      if (!response.ok || !active) {
        return;
      }
      const payload = (await response.json()) as { tasks?: DemandTask[] };
      if (active && Array.isArray(payload.tasks) && payload.tasks.length > 0) {
        setTasks(payload.tasks);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function persistTasks(nextTasks: DemandTask[]) {
    await fetch("/api/command-center/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: nextTasks }),
    }).catch(() => undefined);
  }

  function commitTasks(updater: (current: DemandTask[]) => DemandTask[]) {
    setTasks((prev) => {
      const next = updater(prev);
      void persistTasks(next);
      return next;
    });
  }

  useEffect(() => {
    if (intelligence.autoMirrorTriggers.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setTasks((prev) => {
        let changed = false;
        const next = [...prev];
        for (const trigger of intelligence.autoMirrorTriggers) {
          const alreadyOpen = next.some(
            (task) =>
              task.status !== "done" &&
              task.impact === "critical" &&
              (task.title.includes(trigger.sourceAssetId) || task.description.includes(trigger.sourceAssetId)),
          );
          if (alreadyOpen) {
            continue;
          }
          changed = true;
          const nowIso = new Date().toISOString();
          const dueIso = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
          const baseId = `AUTO-${trigger.sourceAssetId}-${Date.now()}`;
          next.unshift(
            {
              id: `${baseId}-CPY`,
              department: "copyResearch",
              title: trigger.copyTask,
              description: `Trigger automatico por asset em vermelho: ${trigger.sourceAssetId}.`,
              squadHead: "Head Copy - Ana",
              assignee: "Copywriter A",
              status: "backlog",
              impact: trigger.impact as FinancialImpact,
              createdAt: nowIso,
              lastMovedAt: nowIso,
              dueAt: dueIso,
              dependencyIds: [],
              doneApproval: {
                required: false,
                approved: false,
                approvedBy: "",
                approvedRole: "",
                approvedAt: "",
                note: "",
              },
              decisionLog: [{ at: toShortTime(nowIso), author: "Sistema", note: "Task espelho automatica (COPY)." }],
            },
            {
              id: `${baseId}-EDT`,
              department: "editorsCreative",
              title: trigger.editTask,
              description: `Trigger automatico por asset em vermelho: ${trigger.sourceAssetId}.`,
              squadHead: "Head Edicao - Nati",
              assignee: "Editor A",
              status: "backlog",
              impact: trigger.impact as FinancialImpact,
              createdAt: nowIso,
              lastMovedAt: nowIso,
              dueAt: dueIso,
              dependencyIds: [`${baseId}-CPY`],
              doneApproval: {
                required: true,
                approved: false,
                approvedBy: "",
                approvedRole: "",
                approvedAt: "",
                note: "",
              },
              decisionLog: [{ at: toShortTime(nowIso), author: "Sistema", note: "Task espelho automatica (EDICAO)." }],
            },
          );
        }
        if (changed) {
          addActivity("Sistema", "War Room AI", "gerou tarefas espelho automaticas", "Command Center", "assets em vermelho");
          void persistTasks(next);
        }
        return changed ? next : prev;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addActivity, intelligence.autoMirrorTriggers]);

  function updateTask(taskId: string, updater: (task: DemandTask) => DemandTask) {
    commitTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
  }

  function moveTask(taskId: string, department: DemandDepartment, status: DemandStatus) {
    const current = tasks.find((task) => task.id === taskId);
    if (
      status === "done" &&
      current?.department === "editorsCreative" &&
      current.doneApproval?.required &&
      !current.doneApproval?.approved
    ) {
      addActivity("COO", actorName, "bloqueou done sem aprovacao", taskId, "exige aprovacao de Midia/CEO");
      return;
    }

    const at = new Date().toISOString();
    const movedLabel = COLUMNS.find((column) => column.id === status)?.label ?? status;
    updateTask(taskId, (task) => ({
      ...task,
      department,
      status,
      lastMovedAt: at,
      decisionLog: [
        ...task.decisionLog,
        {
          at: toShortTime(at),
          author: actorName,
          note: `Movida para ${movedLabel}.`,
        },
      ],
    }));
    addActivity("COO", actorName, "moveu demanda", taskId, `novo status ${status}`);
  }

  function applyImpact(taskId: string, impact: FinancialImpact) {
    const nowIso = new Date().toISOString();
    const dueIso = new Date(nowMs + 12 * 60 * 60 * 1000).toISOString();
    updateTask(taskId, (task) => ({
      ...task,
      impact,
      dueAt: impact === "critical" ? dueIso : task.dueAt,
      lastMovedAt: nowIso,
      decisionLog: [
        ...task.decisionLog,
        {
          at: toShortTime(nowIso),
          author: actorName,
          note: `PIF ajustado para ${impact}.`,
        },
      ],
    }));
  }

  function assignTask(taskId: string, assignee: string) {
    const nowIso = new Date().toISOString();
    updateTask(taskId, (task) => ({
      ...task,
      assignee,
      lastMovedAt: nowIso,
      decisionLog: [
        ...task.decisionLog,
        {
          at: toShortTime(nowIso),
          author: actorName,
          note: `Delegada para ${assignee}.`,
        },
      ],
    }));
    addActivity("COO", actorName, "delegou demanda", taskId, `responsavel ${assignee}`);
  }

  function addDecision(taskId: string) {
    const note = (decisionDrafts[taskId] ?? "").trim();
    if (!note) {
      return;
    }
    const nowIso = new Date().toISOString();
    updateTask(taskId, (task) => ({
      ...task,
      decisionLog: [
        ...task.decisionLog,
        {
          at: toShortTime(nowIso),
          author: actorName,
          note,
        },
      ],
    }));
    setDecisionDrafts((prev) => ({ ...prev, [taskId]: "" }));
    addActivity("COO", actorName, "registrou decisao", taskId, note);
  }

  function createMirrorDemands() {
    if (!effectiveSelectedFatigueCreativeId) {
      return;
    }
    const hasOpenWorkflow = tasks.some(
      (task) => task.status !== "done" && task.title.includes(effectiveSelectedFatigueCreativeId) && task.impact === "critical",
    );
    if (hasOpenWorkflow) {
      addActivity("COO", actorName, "ignorar automacao duplicada", effectiveSelectedFatigueCreativeId, "workflow ja aberto");
      return;
    }

    const nowIso = new Date().toISOString();
    const dueIso = new Date(nowMs + 12 * 60 * 60 * 1000).toISOString();
    const baseId = `DEM-${Date.now()}`;
    const trafficTask: DemandTask = {
      id: `${baseId}-TRF`,
      department: "trafficMedia",
      title: `Fadiga detectada no winner ${effectiveSelectedFatigueCreativeId}`,
      description: "Confirmar queda de CTR e acionar workflow espelho para copy + edicao.",
      squadHead: "Head Midia - Caio",
      assignee: "Media Buyer A",
      status: "doing",
      impact: "critical",
      createdAt: nowIso,
      lastMovedAt: nowIso,
      dueAt: dueIso,
      dependencyIds: [],
      doneApproval: {
        required: false,
        approved: false,
        approvedBy: "",
        approvedRole: "",
        approvedAt: "",
        note: "",
      },
      decisionLog: [{ at: toShortTime(nowIso), author: actorName, note: "Demanda base criada automaticamente." }],
    };
    const copyTask: DemandTask = {
      id: `${baseId}-CPY`,
      department: "copyResearch",
      title: `Refatoracao de gancho para ${effectiveSelectedFatigueCreativeId}`,
      description: "Criar nova abertura e promessa para recuperar tracao do winner.",
      squadHead: "Head Copy - Ana",
      assignee: "Copywriter A",
      status: "backlog",
      impact: "critical",
      createdAt: nowIso,
      lastMovedAt: nowIso,
      dueAt: dueIso,
      dependencyIds: [trafficTask.id],
      doneApproval: {
        required: false,
        approved: false,
        approvedBy: "",
        approvedRole: "",
        approvedAt: "",
        note: "",
      },
      decisionLog: [{ at: toShortTime(nowIso), author: actorName, note: "Tarefa espelho aberta pelo trafego." }],
    };
    const editTask: DemandTask = {
      id: `${baseId}-EDT`,
      department: "editorsCreative",
      title: `Novas variacoes visuais para ${effectiveSelectedFatigueCreativeId}`,
      description: "Produzir V2/V3 com pattern interrupt e ritmo de corte acelerado.",
      squadHead: "Head Edicao - Nati",
      assignee: "Editor A",
      status: "backlog",
      impact: "critical",
      createdAt: nowIso,
      lastMovedAt: nowIso,
      dueAt: dueIso,
      dependencyIds: [trafficTask.id],
      doneApproval: {
        required: true,
        approved: false,
        approvedBy: "",
        approvedRole: "",
        approvedAt: "",
        note: "",
      },
      decisionLog: [{ at: toShortTime(nowIso), author: actorName, note: "Tarefa espelho aberta pelo trafego." }],
    };

    commitTasks((prev) => [trafficTask, copyTask, editTask, ...prev]);
    addActivity("COO", actorName, "acionou workflow espelho", effectiveSelectedFatigueCreativeId, "trafego -> copy + edicao");
  }

  async function approveTask(taskId: string) {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) {
      return;
    }
    const response = await fetch("/api/command-center/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        note: `Aprovado por ${actorName} (${actorRole}).`,
        task: currentTask,
      }),
    });
    if (!response.ok) {
      addActivity("COO", actorName, "falhou ao aprovar tarefa", taskId, "sem permissao ou task ausente");
      return;
    }
    const payload = (await response.json()) as { task?: DemandTask };
    if (!payload.task) {
      return;
    }
    updateTask(taskId, () => payload.task as DemandTask);
    addActivity("COO", actorName, "aprovou qualidade para done", taskId, "gate Midia/CEO");
  }

  const throughput = useMemo(() => {
    const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
    const highImpact = tasks.filter((task) => task.impact === "high" || task.impact === "critical");
    const delivered = highImpact.filter((task) => task.status === "done" && new Date(task.lastMovedAt).getTime() >= weekAgo).length;
    const pending = highImpact.filter((task) => task.status !== "done").length;
    return { delivered, pending };
  }, [nowMs, tasks]);

  const bottlenecks = useMemo(() => {
    return DEPARTMENTS.map((department) => {
      const staleBacklog = tasks.filter((task) => {
        if (task.department !== department.id || task.status !== "backlog") {
          return false;
        }
        const movedAt = new Date(task.lastMovedAt).getTime();
        return Number.isFinite(movedAt) && nowMs - movedAt > 24 * 60 * 60 * 1000;
      }).length;
      return {
        department: department.id,
        label: department.label,
        staleBacklog,
        isCritical: staleBacklog > 10,
      };
    });
  }, [nowMs, tasks]);

  function renderTaskCard(task: DemandTask) {
    const members = data.commandCenter.squadMembers[task.department] ?? [];
    const countdown = getSlaCountdown(task, nowMs);
    const isSlaExpired = countdown === "SLA estourado";
    const logPreview = task.decisionLog.slice(-2);
    return (
      <div
        key={task.id}
        draggable
        onDragStart={() => setDragTaskId(task.id)}
        className={`rounded-md border border-white/15 bg-[#1F1F23]/80 p-2 text-xs ${
          task.impact === "critical" ? "animate-pulse border-[#EA4335]/50" : ""
        }`}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="font-medium text-slate-100">{task.title}</p>
          <Badge variant={impactBadgeVariant(task.impact)}>{task.impact.toUpperCase()}</Badge>
        </div>
        <p className="mb-2 text-[11px] text-slate-400">{task.description}</p>

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[10px]">
            {getInitials(task.assignee)}
          </div>
          <select
            value={task.assignee}
            onChange={(event) => assignTask(task.id, event.target.value)}
            className="h-6 min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-1 text-[11px]"
          >
            {[task.assignee, ...members.filter((member) => member !== task.assignee)].map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-1">
          <select
            value={task.impact}
            onChange={(event) => applyImpact(task.id, event.target.value as FinancialImpact)}
            className="h-6 rounded border border-white/15 bg-black/40 px-1 text-[11px]"
          >
            {IMPACT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end text-[11px] text-slate-400">
            Dep: {task.dependencyIds.length}
          </div>
        </div>

        {task.doneApproval?.required && (
          <div className="mb-2 rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px]">
            {task.doneApproval?.approved ? (
              <p className="text-[#10B981]">
                Gate Done: aprovado por {task.doneApproval?.approvedBy || "--"} ({task.doneApproval?.approvedRole || "--"})
              </p>
            ) : (
              <p className="text-[#FF9900]">Gate Done: aguardando aprovacao de Head Midia/CEO</p>
            )}
            {!task.doneApproval?.approved && canApproveDone && (
              <Button type="button" className="mt-1 h-6 px-2 text-[11px]" onClick={() => void approveTask(task.id)}>
                Aprovar Qualidade
              </Button>
            )}
          </div>
        )}

        {countdown ? (
          <div className={`mb-2 rounded border px-1.5 py-1 text-[11px] ${isSlaExpired ? "border-rose-300/50 text-rose-200" : "border-[#FF9900]/40 text-[#FFD39A]"}`}>
            SLA 12h: {countdown}
          </div>
        ) : null}

        <div className="space-y-1">
          {logPreview.map((log, index) => (
            <p key={`${task.id}-${log.at}-${index}`} className="text-[10px] text-slate-400">
              [{log.at}] {log.author}: {log.note}
            </p>
          ))}
        </div>

        <div className="mt-2 flex gap-1">
          <input
            value={decisionDrafts[task.id] ?? ""}
            onChange={(event) => setDecisionDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))}
            placeholder="Log de decisao..."
            className="h-6 flex-1 rounded border border-white/15 bg-black/40 px-1 text-[11px]"
          />
          <Button type="button" className="h-6 px-2 text-[11px]" onClick={() => addDecision(task.id)}>
            Log
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-[#FF9900]/30 bg-[#0b0b0b]">
        <CardHeader>
          <CardTitle className="text-base">COMMAND CENTER DE DEMANDAS (Macro-Management)</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Kanban de alto impacto financeiro com delegacao por squad head e automacao interdependente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs">
            <p className="mb-2 text-slate-200">Throughput de Escala (alto impacto)</p>
            <p className="text-slate-300">Entregues (semana): {throughput.delivered}</p>
            <p className="text-slate-300">Pendentes: {throughput.pending}</p>
            <div className="mt-2 h-2 rounded bg-slate-800">
              <div
                className="h-2 rounded bg-[#10B981]"
                style={{ width: `${Math.min(100, (throughput.delivered / Math.max(1, throughput.delivered + throughput.pending)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs">
            <p className="mb-2 text-slate-200">Gargalo Detector (&gt;10 backlog parado 24h)</p>
            <div className="space-y-1">
              {bottlenecks.map((bottleneck) => (
                <div key={bottleneck.department}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>{bottleneck.label}</span>
                    <span className={bottleneck.isCritical ? "text-[#EA4335]" : "text-slate-400"}>{bottleneck.staleBacklog}</span>
                  </div>
                  <div className="h-1.5 rounded bg-slate-800">
                    <div
                      className={`h-1.5 rounded ${bottleneck.isCritical ? "bg-[#EA4335]" : "bg-[#FF9900]"}`}
                      style={{ width: `${Math.min(100, (bottleneck.staleBacklog / 12) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs">
            <p className="mb-2 text-slate-200">Automacao de Workflow Espelho</p>
            <p className="mb-2 text-slate-400">
              Quando Midia sinaliza fadiga em winner, sistema abre demandas vinculadas para Copy e Edicao.
            </p>
            <select
              value={effectiveSelectedFatigueCreativeId}
              onChange={(event) => setSelectedFatigueCreativeId(event.target.value)}
              className="mb-2 h-7 w-full rounded border border-white/15 bg-black/40 px-2 text-[11px]"
            >
              {fatigueWinners.length === 0 ? (
                <option value="">Sem winners com fadiga agora</option>
              ) : (
                fatigueWinners.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.id} | ROAS {candidate.roas.toFixed(2)}
                  </option>
                ))
              )}
            </select>
            <Button
              type="button"
              className="h-7 w-full text-[11px]"
              onClick={createMirrorDemands}
              disabled={!effectiveSelectedFatigueCreativeId}
            >
              Sinalizar fadiga e abrir tarefas espelho
            </Button>
          </div>
        </CardContent>
      </Card>

      {DEPARTMENTS.map((department) => {
        const departmentTasks = tasks.filter((task) => task.department === department.id).sort(sortByPriority);
        const head = departmentTasks[0]?.squadHead ?? department.headLabel;
        return (
          <Card key={department.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {department.label} <span className="ml-2 text-xs font-normal text-slate-400">Squad Head: {head}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 xl:grid-cols-4">
                {COLUMNS.map((column) => (
                  <div
                    key={`${department.id}-${column.id}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!dragTaskId) return;
                      moveTask(dragTaskId, department.id, column.id);
                      setDragTaskId(null);
                    }}
                    className="rounded-lg border border-white/10 bg-black/30 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-slate-300">{column.label}</p>
                      <Badge variant="default">
                        {departmentTasks.filter((task) => task.status === column.id).length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {departmentTasks.filter((task) => task.status === column.id).map((task) => renderTaskCard(task))}
                      {departmentTasks.filter((task) => task.status === column.id).length === 0 && (
                        <p className="rounded border border-dashed border-white/15 p-2 text-[11px] text-slate-500">Sem tarefas</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
