import { redisPing } from "@/lib/infra/redis";

export type ReadinessStatus = "pass" | "warn" | "fail";

export type GoLiveCheck = {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

export type GoLiveReadinessSnapshot = {
  generatedAt: string;
  environment: string;
  goNoGo: boolean;
  checks: GoLiveCheck[];
  blockingFailures: string[];
};

function requiredSecretLength() {
  const value = Number(process.env.WAR_ROOM_MIN_SECRET_LENGTH ?? 24);
  return Number.isFinite(value) ? Math.max(12, value) : 24;
}

function hasStrongSecret(value: string | undefined, minLength: number) {
  const secret = (value ?? "").trim();
  return secret.length >= minLength;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isDatabasePersistenceEnabled() {
  return process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
}

export async function evaluateGoLiveReadiness(): Promise<GoLiveReadinessSnapshot> {
  const checks: GoLiveCheck[] = [];
  const minSecretLength = requiredSecretLength();
  const prod = isProduction();

  const databasePersistence = isDatabasePersistenceEnabled();
  checks.push({
    id: "persistence_mode",
    label: "Persistencia operacional em banco",
    status: databasePersistence ? "pass" : prod ? "fail" : "warn",
    detail: databasePersistence
      ? "WAR_ROOM_OPS_PERSISTENCE_MODE=database com DATABASE_URL configurada."
      : "Modo atual nao usa banco como origem principal de persistencia.",
  });

  const webhookKeyStrong = hasStrongSecret(process.env.WAR_ROOM_WEBHOOK_API_KEY, minSecretLength);
  const offersKeyStrong = hasStrongSecret(process.env.OFFERS_LAB_API_KEY, minSecretLength);
  checks.push({
    id: "api_keys_strength",
    label: "Forca de chaves de webhook/API",
    status: webhookKeyStrong && offersKeyStrong ? "pass" : prod ? "fail" : "warn",
    detail:
      webhookKeyStrong && offersKeyStrong
        ? `WAR_ROOM_WEBHOOK_API_KEY e OFFERS_LAB_API_KEY com >= ${minSecretLength} caracteres.`
        : `Uma ou mais chaves curtas/ausentes (minimo recomendado: ${minSecretLength}).`,
  });

  const requireHmacInProd = process.env.WAR_ROOM_REQUIRE_HMAC_IN_PROD === "true";
  const providerSecrets = [
    process.env.UTMIFY_WEBHOOK_SECRET,
    process.env.APPMAX_WEBHOOK_SECRET,
    process.env.KIWIFY_WEBHOOK_SECRET,
    process.env.YAMPI_WEBHOOK_SECRET,
  ];
  const hasAllProviderSecrets = providerSecrets.every((item) => hasStrongSecret(item, minSecretLength));
  checks.push({
    id: "webhook_hmac",
    label: "Segredos HMAC por provider",
    status: hasAllProviderSecrets ? "pass" : prod && requireHmacInProd ? "fail" : "warn",
    detail: hasAllProviderSecrets
      ? "Todos os segredos HMAC de webhooks estao configurados."
      : "Faltam segredos HMAC (UTMIFY/APPMAX/KIWIFY/YAMPI).",
  });

  const monitoringConfigured = Boolean(
    (process.env.ERROR_MONITOR_WEBHOOK_URL ?? "").trim() || (process.env.SENTRY_WEBHOOK_URL ?? "").trim(),
  );
  checks.push({
    id: "error_monitoring",
    label: "Monitoramento externo de erros",
    status: monitoringConfigured ? "pass" : prod ? "fail" : "warn",
    detail: monitoringConfigured
      ? "ERROR_MONITOR_WEBHOOK_URL ou SENTRY_WEBHOOK_URL configurado."
      : "Sem monitoramento externo configurado.",
  });

  const syncConfigured = Boolean((process.env.UTMIFY_SYNC_URL ?? process.env.UTMIFY_API_URL ?? "").trim());
  checks.push({
    id: "sync_source",
    label: "Fonte de sync de atribuicao",
    status: syncConfigured ? "pass" : prod ? "fail" : "warn",
    detail: syncConfigured
      ? "UTMIFY_SYNC_URL/UTMIFY_API_URL configurada."
      : "Sem endpoint de sync configurado para Offers Lab.",
  });

  const backupEvidence = Boolean((process.env.WAR_ROOM_BACKUP_LAST_SUCCESS_AT ?? "").trim());
  checks.push({
    id: "backup_evidence",
    label: "Evidencia de backup recente",
    status: backupEvidence ? "pass" : prod ? "warn" : "warn",
    detail: backupEvidence
      ? `Ultimo backup informado em WAR_ROOM_BACKUP_LAST_SUCCESS_AT=${process.env.WAR_ROOM_BACKUP_LAST_SUCCESS_AT}`
      : "Nao ha evidencia de backup recente via env WAR_ROOM_BACKUP_LAST_SUCCESS_AT.",
  });

  const requireRedisInProd = process.env.WAR_ROOM_REQUIRE_REDIS_IN_PROD === "true";
  const redis = await redisPing();
  checks.push({
    id: "redis_connectivity",
    label: "Redis distribuido (cache/rate-limit)",
    status: redis.ok ? "pass" : prod && requireRedisInProd ? "fail" : "warn",
    detail: redis.ok ? "Conectividade Redis OK (PING)." : `Redis indisponivel (${redis.reason}).`,
  });

  const blockingFailures = checks.filter((check) => check.status === "fail").map((check) => check.id);

  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    goNoGo: blockingFailures.length === 0,
    checks,
    blockingFailures,
  };
}

export async function assertProductionReadinessIfRequired(context: string) {
  if (!isProduction()) {
    return;
  }
  if (process.env.WAR_ROOM_ENFORCE_PROD_HARDENING !== "true") {
    return;
  }
  const snapshot = await evaluateGoLiveReadiness();
  if (!snapshot.goNoGo) {
    throw new Error(
      `[GO-LIVE BLOCKED:${context}] Falhas criticas de prontidao: ${snapshot.blockingFailures.join(", ")}`,
    );
  }
}
