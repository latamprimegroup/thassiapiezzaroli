import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { listDeadLetterEvents } from "@/lib/persistence/war-room-ops-store";
import { safeDivide } from "@/lib/metrics/kpis";
import { getOpsJobStats } from "@/lib/persistence/war-room-ops-store";

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
    overallStatus,
  };
}

export type WarRoomObservabilitySnapshot = ReturnTypeAsync<typeof getWarRoomObservabilitySnapshot>;
