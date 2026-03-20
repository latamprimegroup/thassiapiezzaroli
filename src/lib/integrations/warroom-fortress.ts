import type { VaultStatus, WarRoomData } from "@/lib/war-room/types";

type SafeBrowsingStatus = "safe" | "unsafe" | "unknown";
type FacebookDebuggerStatus = "ok" | "warning" | "down" | "unknown";

type VaultDomainSnapshot = WarRoomData["integrations"]["fortress"]["vault"]["domains"][number];

type VaultRuntimeState = {
  lastRunAtMs: number;
  domains: VaultDomainSnapshot[];
};

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

declare global {
  var __warRoomVaultRuntimeState: VaultRuntimeState | undefined;
}

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function toVaultStatus(
  safeBrowsingStatus: SafeBrowsingStatus,
  facebookDebuggerStatus: FacebookDebuggerStatus,
  fallback: VaultStatus,
): VaultStatus {
  if (safeBrowsingStatus === "unsafe" || facebookDebuggerStatus === "down") {
    return "blocked";
  }
  if (safeBrowsingStatus === "unknown" || facebookDebuggerStatus === "warning" || facebookDebuggerStatus === "unknown") {
    return fallback === "blocked" ? "warning" : fallback;
  }
  return "ok";
}

async function checkSafeBrowsing(domain: string): Promise<SafeBrowsingStatus> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    return "unknown";
  }
  try {
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "war-room-os", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: `https://${domain}` }],
        },
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return "unknown";
    }
    const payload = (await response.json().catch(() => ({}))) as { matches?: unknown[] };
    return Array.isArray(payload.matches) && payload.matches.length > 0 ? "unsafe" : "safe";
  } catch {
    return "unknown";
  }
}

async function checkFacebookDebugger(domain: string): Promise<FacebookDebuggerStatus> {
  const token = process.env.META_GRAPH_ACCESS_TOKEN;
  if (!token) {
    return "unknown";
  }
  try {
    const url = `https://graph.facebook.com/v20.0/?id=${encodeURIComponent(`https://${domain}`)}&access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return "down";
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (payload.error) {
      return "warning";
    }
    return payload.id ? "ok" : "warning";
  } catch {
    return "down";
  }
}

function getRuntimeState(): VaultRuntimeState {
  if (!globalThis.__warRoomVaultRuntimeState) {
    globalThis.__warRoomVaultRuntimeState = { lastRunAtMs: 0, domains: [] };
  }
  return globalThis.__warRoomVaultRuntimeState;
}

async function runDomainChecks(base: WarRoomData): Promise<VaultDomainSnapshot[]> {
  const configuredDomains = (process.env.WAR_ROOM_VAULT_DOMAINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const domains = configuredDomains.length > 0 ? configuredDomains : base.contingency.domains.map((domain) => domain.name);
  const fallbackByDomain = new Map(base.contingency.domains.map((domain) => [domain.name, domain]));
  const checkedAt = nowLabel();

  const snapshots = await Promise.all(
    domains.map(async (domain) => {
      const fallback = fallbackByDomain.get(domain);
      const safeBrowsingStatus = await checkSafeBrowsing(domain);
      const facebookDebuggerStatus = await checkFacebookDebugger(domain);
      const status = toVaultStatus(safeBrowsingStatus, facebookDebuggerStatus, fallback?.status ?? "warning");
      const note =
        status === "blocked"
          ? "Dominio em risco. Ativar contingencia imediatamente."
          : status === "warning"
            ? "Risco moderado. Revalidar DNS, reputacao e debugger."
            : "Saude do dominio estavel.";
      return {
        domain,
        safeBrowsingStatus,
        facebookDebuggerStatus,
        blacklistHits: safeBrowsingStatus === "unsafe" ? 1 : 0,
        status,
        note,
        checkedAt,
      } satisfies VaultDomainSnapshot;
    }),
  );

  return snapshots;
}

function buildExecutiveBriefing(data: WarRoomData) {
  const generatedAt = nowLabel();
  const bestAsset =
    [...data.integrations.attribution.validatedAssets]
      .sort((a, b) => a.effectiveCpa - b.effectiveCpa)
      .find((asset) => asset.status === "scale")?.assetId ?? "N/A";
  const mer = data.integrations.merCross.value;
  const profit = data.enterprise.ceoFinance.netProfit;
  const approval = data.integrations.gateway.appmaxCardApprovalRate;

  const summary =
    mer >= 2.5
      ? `Hoje o ativo ${bestAsset} sustentou a escala com MER em ${mer.toFixed(2)}x e lucro real em ${profit.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}.`
      : `Hoje o MER fechou em ${mer.toFixed(2)}x, abaixo do nivel seguro, exigindo reducao imediata de risco operacional.`;
  const suggestedAction =
    approval < 80
      ? "Aprovacao Appmax em queda: testar processador alternativo e revisar regra antifraude hoje."
      : data.integrations.fortress.pixelSync.status === "unhealthy"
        ? "Divergencia de Pixel/CAPI acima de 20%: revisar eventos Purchase e deduplicacao no Gerenciador."
        : "Manter escala apenas nos IDs verdes e reforcar monitoramento do cofre de contingencia a cada 30 minutos.";

  return { generatedAt, summary, suggestedAction };
}

export async function applyFortressLayer(input: WarRoomData): Promise<WarRoomData> {
  const next = structuredClone(input);
  const runtimeState = getRuntimeState();
  const nowMs = Date.now();
  const shouldRun = nowMs - runtimeState.lastRunAtMs >= CHECK_INTERVAL_MS || runtimeState.domains.length === 0;

  if (shouldRun) {
    runtimeState.domains = await runDomainChecks(next);
    runtimeState.lastRunAtMs = nowMs;
  }

  if (runtimeState.domains.length > 0) {
    next.integrations.fortress.vault.domains = runtimeState.domains;
    next.integrations.fortress.vault.lastCheckAt = nowLabel();
    const blocked = runtimeState.domains.some((domain) => domain.status === "blocked");
    const warning = runtimeState.domains.some((domain) => domain.status === "warning");
    next.integrations.fortress.vault.overallStatus = blocked ? "blocked" : warning ? "warning" : "ok";

    const statusByDomain = new Map(runtimeState.domains.map((domain) => [domain.domain, domain.status]));
    next.contingency.domains = next.contingency.domains.map((domain) => ({
      ...domain,
      status: statusByDomain.get(domain.name) ?? domain.status,
      lastCheck: next.integrations.fortress.vault.lastCheckAt,
    }));
  }

  const sirenReasons: string[] = [];
  if (next.integrations.merCross.value > 0 && next.integrations.merCross.value < 2.0) {
    sirenReasons.push(`MER Global ${next.integrations.merCross.value.toFixed(2)}x abaixo de 2.0x`);
  }
  if (next.integrations.fortress.vault.overallStatus === "blocked") {
    sirenReasons.push("Dominio em status BLOCKED no Cofre de Contingencia");
  }
  if (next.integrations.fortress.pixelSync.status === "unhealthy") {
    sirenReasons.push("Erro de CAPI/Pixel com divergencia acima de 20%");
  }

  next.integrations.fortress.siren = {
    active: sirenReasons.length > 0,
    reasons: sirenReasons,
    severity: sirenReasons.length > 0 ? "critical" : "normal",
  };

  next.integrations.fortress.executiveBriefing = buildExecutiveBriefing(next);
  return next;
}
