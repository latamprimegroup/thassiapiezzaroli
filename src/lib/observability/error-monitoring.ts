import { randomUUID } from "node:crypto";
import { appendSilentError, type SilentErrorRecord } from "@/lib/observability/error-monitoring-store";

function toMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown_error";
  }
}

function toStack(error: unknown) {
  if (error instanceof Error && error.stack) {
    return error.stack.slice(0, 4_000);
  }
  return "";
}

async function maybeForwardToWebhook(record: SilentErrorRecord) {
  const url = process.env.ERROR_MONITOR_WEBHOOK_URL || process.env.SENTRY_WEBHOOK_URL;
  if (!url) {
    return;
  }
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => undefined);
}

export async function captureServerError(params: {
  route: string;
  error: unknown;
  context?: Record<string, unknown>;
  level?: SilentErrorRecord["level"];
}) {
  const record: SilentErrorRecord = {
    id: `ERR-${randomUUID().slice(0, 8)}`,
    source: "server",
    route: params.route,
    message: toMessage(params.error),
    stack: toStack(params.error),
    context: params.context ?? {},
    level: params.level ?? "error",
    occurredAt: new Date().toISOString(),
  };
  await appendSilentError(record);
  await maybeForwardToWebhook(record);
}

