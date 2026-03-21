import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import {
  listDeadLetterEvents,
  listOpsIncidents,
  getOpsIncidentMetrics,
  resolveOpsIncidentByKey,
  upsertOpsIncident,
} from "@/lib/persistence/war-room-ops-repository";
import { safeDivide } from "@/lib/metrics/kpis";
import { getOpsJobStats } from "@/lib/persistence/war-room-ops-repository";

type ReturnTypeAsync<T extends (...args: never[]) => Promise<unknown>> = T extends (
  ...args: never[]
) => Promise<infer R>
  ? R
  : never;

type SloStatus = "pass" | "warning" | "breach";

type SloItem = {
  id: "queueDrain" | "errorRate" | "mttr";
  label: string;
  target: string;
  current: string;
  status: SloStatus;
  note: string;
};

type ObservabilitySnapshot = {
  generatedAt: string;
  queue: {
    depth: number;
    failedJobs: number;
    processedToday: number;
    deadLetterEvents: number;
    estimatedDrainMinutes: number;
  };
  reliability: {
    errorRatePct: number;
    estimatedMttrMinutes: number;
  };
  slos: SloItem[];
  incidentCenter: {
    openCount: number;
    resolvedCount: number;
    breachedOpenCount: number;
    mttrBySquad: Array<{
      squad: "techCro" | "trafficMedia" | "copyResearch" | "ceoFinance" | "platform";
      incidents: number;
      mttrMinutes: number;
    }>;
    recent: Array<{
      id: string;
      squad: "techCro" | "trafficMedia" | "copyResearch" | "ceoFinance" | "platform";
      severity: "warning" | "critical";
      status: "open" | "resolved";
      title: string;
      description: string;
      startedAt: string;
      resolvedAt: string;
      slaTargetMinutes: number;
      slaBreached: boolean;
      resolutionMinutes: number;
    }>;
  };
  overallStatus: SloStatus;
};

function toStatus(score: { pass: boolean; warning?: boolean }): SloStatus {
  if (score.pass) {
    return "pass";
  }
  if (score.warning) {
    return "warning";
  }
  return "breach";
}

function maxStatus(a: SloStatus, b: SloStatus): SloStatus {
  const rank: Record<SloStatus, number> = { pass: 0, warning: 1, breach: 2 };
  return rank[a] >= rank[b] ? a : b;
}

async function syncSloIncident(params: {
  key: string;
  status: SloStatus;
  title: string;
  description: string;
  squad: "techCro" | "trafficMedia" | "copyResearch" | "ceoFinance" | "platform";
  source: string;
  slaTargetMinutes: number;
}) {
  if (params.status === "pass") {
    await resolveOpsIncidentByKey(params.key);
    return;
  }
  await upsertOpsIncident({
    key: params.key,
    squad: params.squad,
    severity: params.status === "breach" ? "critical" : "warning",
    title: params.title,
    description: params.description,
    source: params.source,
    slaTargetMinutes: params.slaTargetMinutes,
  });
}

export async function getWarRoomObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const stats = await getOpsJobStats();
  const deadLetters = await listDeadLetterEvents(WAR_ROOM_OPS_CONSTANTS.queue.webhook.deadLetterListBatchSize);

  const minutesSinceDayStart = Math.max(
    1,
    Math.floor((Date.now() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 60_000),
  );
  const processRatePerMinute = safeDivide(stats.processedToday, minutesSinceDayStart);
  const estimatedDrainMinutes = stats.queueDepth > 0 ? safeDivide(stats.queueDepth, processRatePerMinute || 0.1) : 0;

  const totalHandledToday = stats.processedToday + stats.failedJobs;
  const errorRatePct = safeDivide(stats.failedJobs, totalHandledToday || 1) * 100;

  // Heuristica de MTTR: backlog de falhas / ritmo de processamento + severidade DLQ.
  const estimatedMttrMinutes = Math.round(
    (stats.failedJobs > 0 ? safeDivide(stats.failedJobs, processRatePerMinute || 0.1) : 0) + deadLetters.length * 2,
  );

  const queueDrainStatus = toStatus({
    pass: estimatedDrainMinutes <= WAR_ROOM_OPS_CONSTANTS.observability.slo.queueDrainP95Minutes,
    warning: estimatedDrainMinutes <= WAR_ROOM_OPS_CONSTANTS.observability.slo.queueDrainP95Minutes * 1.5,
  });
  const errorRateStatus = toStatus({
    pass: errorRatePct <= WAR_ROOM_OPS_CONSTANTS.observability.slo.maxErrorRatePct,
    warning: errorRatePct <= WAR_ROOM_OPS_CONSTANTS.observability.slo.maxErrorRatePct * 2,
  });
  const mttrStatus = toStatus({
    pass: estimatedMttrMinutes <= WAR_ROOM_OPS_CONSTANTS.observability.slo.mttrMinutesTarget,
    warning: estimatedMttrMinutes <= WAR_ROOM_OPS_CONSTANTS.observability.slo.mttrMinutesTarget * 1.5,
  });

  const slos: SloItem[] = [
    {
      id: "queueDrain",
      label: "Queue Drain",
      target: `<= ${WAR_ROOM_OPS_CONSTANTS.observability.slo.queueDrainP95Minutes} min`,
      current: `${estimatedDrainMinutes.toFixed(1)} min`,
      status: queueDrainStatus,
      note: "Tempo estimado para drenar backlog atual.",
    },
    {
      id: "errorRate",
      label: "Error Rate",
      target: `<= ${WAR_ROOM_OPS_CONSTANTS.observability.slo.maxErrorRatePct.toFixed(2)}%`,
      current: `${errorRatePct.toFixed(2)}%`,
      status: errorRateStatus,
      note: "Falhas vs jobs processados no dia.",
    },
    {
      id: "mttr",
      label: "MTTR Estimado",
      target: `<= ${WAR_ROOM_OPS_CONSTANTS.observability.slo.mttrMinutesTarget} min`,
      current: `${estimatedMttrMinutes} min`,
      status: mttrStatus,
      note: "Estimativa de recuperacao com base em fila e falhas atuais.",
    },
  ];

  await Promise.all([
    syncSloIncident({
      key: "slo:queueDrain",
      status: queueDrainStatus,
      title: "Queue Drain acima do SLO",
      description: `Tempo de drenagem estimado ${estimatedDrainMinutes.toFixed(1)} min.`,
      squad: "techCro",
      source: "ops-observability",
      slaTargetMinutes: WAR_ROOM_OPS_CONSTANTS.observability.incidents.squadSlaMinutes.techCro,
    }),
    syncSloIncident({
      key: "slo:errorRate",
      status: errorRateStatus,
      title: "Error Rate acima do SLO",
      description: `Taxa de erro atual ${errorRatePct.toFixed(2)}%.`,
      squad: "trafficMedia",
      source: "ops-observability",
      slaTargetMinutes: WAR_ROOM_OPS_CONSTANTS.observability.incidents.squadSlaMinutes.trafficMedia,
    }),
    syncSloIncident({
      key: "slo:mttr",
      status: mttrStatus,
      title: "MTTR estimado acima do alvo",
      description: `MTTR estimado ${estimatedMttrMinutes} minutos.`,
      squad: "techCro",
      source: "ops-observability",
      slaTargetMinutes: WAR_ROOM_OPS_CONSTANTS.observability.incidents.squadSlaMinutes.techCro,
    }),
    syncSloIncident({
      key: "pipeline:deadletter",
      status:
        deadLetters.length >= WAR_ROOM_OPS_CONSTANTS.observability.incidents.deadLetterIncidentThreshold
          ? "breach"
          : "pass",
      title: "Dead-letter events detectados",
      description: `${deadLetters.length} eventos em DLQ aguardando tratamento.`,
      squad: "platform",
      source: "ops-observability",
      slaTargetMinutes: WAR_ROOM_OPS_CONSTANTS.observability.incidents.squadSlaMinutes.platform,
    }),
  ]);

  const incidentMetrics = await getOpsIncidentMetrics(WAR_ROOM_OPS_CONSTANTS.observability.incidents.historyRetentionDays);
  const recentIncidents = await listOpsIncidents({ limit: WAR_ROOM_OPS_CONSTANTS.observability.incidents.maxRecentItems });

  const overallStatus = slos.reduce<SloStatus>((acc, item) => maxStatus(acc, item.status), "pass");

  return {
    generatedAt: new Date().toISOString(),
    queue: {
      depth: stats.queueDepth,
      failedJobs: stats.failedJobs,
      processedToday: stats.processedToday,
      deadLetterEvents: deadLetters.length,
      estimatedDrainMinutes,
    },
    reliability: {
      errorRatePct,
      estimatedMttrMinutes,
    },
    slos,
    incidentCenter: {
      openCount: incidentMetrics.openCount,
      resolvedCount: incidentMetrics.resolvedCount,
      breachedOpenCount: incidentMetrics.breachedOpenCount,
      mttrBySquad: incidentMetrics.mttrBySquad,
      recent: recentIncidents.map((incident) => ({
        id: incident.id,
        squad: incident.squad,
        severity: incident.severity,
        status: incident.status,
        title: incident.title,
        description: incident.description,
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        slaTargetMinutes: incident.slaTargetMinutes,
        slaBreached: incident.slaBreached,
        resolutionMinutes: incident.resolutionMinutes,
      })),
    },
    overallStatus,
  };
}

export type WarRoomObservabilitySnapshot = ReturnTypeAsync<typeof getWarRoomObservabilitySnapshot>;
