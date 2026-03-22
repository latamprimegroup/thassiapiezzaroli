import { enrichWarRoomOperations, mergeWarRoomWithIntegrations } from "@/lib/integrations/warroom-integration-store";
import { runPullSyncForGatewayAttribution } from "@/lib/integrations/warroom-pull-sync";
import { processDueWebhookRetries } from "@/lib/integrations/warroom-webhook-service";
import { applyFortressLayer } from "@/lib/integrations/warroom-fortress";
import { applyAutomaticRoutingFromSignals } from "@/lib/routing/traffic-router";
import { processOpsJobQueue } from "@/lib/ops/war-room-ops-worker";
import { mergeCommandCenterFromStore } from "@/lib/command-center/command-center-persistence";
import { applyOfferScaleDemands } from "@/lib/command-center/offer-demand-automation";
import { getOffersLabDashboard } from "@/lib/offers/offers-lab-service";
import { enrichCustomerCentrality } from "@/lib/metrics/customer-centrality";
import { mockWarRoomData } from "./mock-data";
import { normalizeWarRoomData } from "./normalize";
import { loadWarRoomFromApi } from "./source-api";
import { loadWarRoomFromSheets } from "./source-sheet";
import type { WarRoomData } from "./types";

type DataSource = "mock" | "api" | "sheet" | "database";

function resolveSource(): DataSource {
  const source = (process.env.WAR_ROOM_SOURCE ?? "mock").toLowerCase();
  if (source === "api" || source === "sheet" || source === "database" || source === "mock") {
    return source;
  }
  return "mock";
}

async function loadBySource(source: DataSource): Promise<WarRoomData> {
  switch (source) {
    case "api":
      return loadWarRoomFromApi();
    case "sheet":
      return loadWarRoomFromSheets();
    case "database": {
      const { loadWarRoomFromDatabase } = await import("./source-db");
      return loadWarRoomFromDatabase();
    }
    case "mock":
    default:
      return normalizeWarRoomData(mockWarRoomData, "mock", "Mock local");
  }
}

export async function getWarRoomData(): Promise<WarRoomData> {
  const source = resolveSource();
  try {
    await processOpsJobQueue(20);
    await processDueWebhookRetries(20);
    await runPullSyncForGatewayAttribution();
    const base = await loadBySource(source);
    const withIntegrations = mergeWarRoomWithIntegrations(base);
    const withCentrality = enrichCustomerCentrality(withIntegrations);
    const withFortress = await applyFortressLayer(withCentrality);
    await applyAutomaticRoutingFromSignals(withFortress);
    const withOps = await enrichWarRoomOperations(withFortress);
    const withPersistedTasks = await mergeCommandCenterFromStore(withOps);
    try {
      const offersLab = await getOffersLabDashboard({ validatedOnly: true });
      return applyOfferScaleDemands(withPersistedTasks, offersLab.validatedOffers);
    } catch {
      return withPersistedTasks;
    }
  } catch (error) {
    console.error("[war-room] Falha ao carregar dados reais:", error);
    const fallback = normalizeWarRoomData(
      {
        ...mockWarRoomData,
        source: "fallback",
        sourceLabel: `Fallback (erro em ${source})`,
        updatedAt: new Date().toISOString(),
      },
      "fallback",
      `Fallback (erro em ${source})`,
    );
    const withIntegrations = mergeWarRoomWithIntegrations(fallback);
    const withCentrality = enrichCustomerCentrality(withIntegrations);
    const withFortress = await applyFortressLayer(withCentrality);
    await applyAutomaticRoutingFromSignals(withFortress);
    const withOps = await enrichWarRoomOperations(withFortress);
    const withPersistedTasks = await mergeCommandCenterFromStore(withOps);
    try {
      const offersLab = await getOffersLabDashboard({ validatedOnly: true });
      return applyOfferScaleDemands(withPersistedTasks, offersLab.validatedOffers);
    } catch {
      return withPersistedTasks;
    }
  }
}
