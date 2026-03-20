import { ingestIntegrationEvent, markProviderError } from "./warroom-integration-store";
import { resolveAdapterByProvider } from "./warroom-adapters";

type ProviderConfig = {
  provider: "utmify" | "appmax" | "kiwify" | "yampi";
  urlEnv: string;
  tokenEnv: string;
};

const providers: ProviderConfig[] = [
  { provider: "utmify", urlEnv: "UTMIFY_API_URL", tokenEnv: "UTMIFY_API_TOKEN" },
  { provider: "appmax", urlEnv: "APPMAX_API_URL", tokenEnv: "APPMAX_API_TOKEN" },
  { provider: "kiwify", urlEnv: "KIWIFY_API_URL", tokenEnv: "KIWIFY_API_TOKEN" },
  { provider: "yampi", urlEnv: "YAMPI_API_URL", tokenEnv: "YAMPI_API_TOKEN" },
];

async function syncProvider(config: ProviderConfig) {
  const url = process.env[config.urlEnv];
  if (!url) {
    return;
  }

  const token = process.env[config.tokenEnv];
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) {
      markProviderError(config.provider, `HTTP ${response.status}`);
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const adapter = resolveAdapterByProvider(config.provider);
    if (!adapter) {
      markProviderError(config.provider, "Adapter nao encontrado.");
      return;
    }
    ingestIntegrationEvent(adapter.adapt(payload));
  } catch (error) {
    markProviderError(config.provider, error instanceof Error ? error.message : "Falha na sincronizacao.");
  }
}

export async function runPullSyncForGatewayAttribution() {
  await Promise.all(providers.map((provider) => syncProvider(provider)));
}
