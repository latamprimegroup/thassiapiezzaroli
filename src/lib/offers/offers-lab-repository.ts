import * as fileStore from "@/lib/offers/offers-lab-store";
import * as dbStore from "@/lib/offers/offers-lab-db";

function isDatabaseMode() {
  const enabled = process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
  const mustUseDatabase =
    process.env.NODE_ENV === "production" && process.env.WAR_ROOM_REQUIRE_DATABASE_IN_PROD === "true";
  if (mustUseDatabase && !enabled) {
    throw new Error(
      "Persistencia em banco obrigatoria em producao. Configure WAR_ROOM_OPS_PERSISTENCE_MODE=database e DATABASE_URL.",
    );
  }
  return enabled;
}

export async function readOffer(...args: Parameters<typeof fileStore.readOffer>) {
  return isDatabaseMode() ? dbStore.readOffer(...args) : fileStore.readOffer(...args);
}

export async function listOffers(...args: Parameters<typeof fileStore.listOffers>) {
  return isDatabaseMode() ? dbStore.listOffers(...args) : fileStore.listOffers(...args);
}

export async function upsertOffer(...args: Parameters<typeof fileStore.upsertOffer>) {
  return isDatabaseMode() ? dbStore.upsertOffer(...args) : fileStore.upsertOffer(...args);
}

export async function appendTrafficEvent(...args: Parameters<typeof fileStore.appendTrafficEvent>) {
  return isDatabaseMode() ? dbStore.appendTrafficEvent(...args) : fileStore.appendTrafficEvent(...args);
}

export async function appendTrafficEventsBatch(...args: Parameters<typeof fileStore.appendTrafficEventsBatch>) {
  return isDatabaseMode() ? dbStore.appendTrafficEventsBatch(...args) : fileStore.appendTrafficEventsBatch(...args);
}

export async function listTrafficEvents(...args: Parameters<typeof fileStore.listTrafficEvents>) {
  return isDatabaseMode() ? dbStore.listTrafficEvents(...args) : fileStore.listTrafficEvents(...args);
}

export async function readSyncState(...args: Parameters<typeof fileStore.readSyncState>) {
  return isDatabaseMode() ? dbStore.readSyncState(...args) : fileStore.readSyncState(...args);
}

export async function writeSyncState(...args: Parameters<typeof fileStore.writeSyncState>) {
  return isDatabaseMode() ? dbStore.writeSyncState(...args) : fileStore.writeSyncState(...args);
}

export async function listUtmAliases(...args: Parameters<typeof fileStore.listUtmAliases>) {
  return isDatabaseMode() ? dbStore.listUtmAliases(...args) : fileStore.listUtmAliases(...args);
}

export async function upsertUtmAlias(...args: Parameters<typeof fileStore.upsertUtmAlias>) {
  return isDatabaseMode() ? dbStore.upsertUtmAlias(...args) : fileStore.upsertUtmAlias(...args);
}

export async function appendQuarantine(...args: Parameters<typeof fileStore.appendQuarantine>) {
  return isDatabaseMode() ? dbStore.appendQuarantine(...args) : fileStore.appendQuarantine(...args);
}

export async function listQuarantine(...args: Parameters<typeof fileStore.listQuarantine>) {
  return isDatabaseMode() ? dbStore.listQuarantine(...args) : fileStore.listQuarantine(...args);
}

export async function appendLtvSample(...args: Parameters<typeof fileStore.appendLtvSample>) {
  return isDatabaseMode() ? dbStore.appendLtvSample(...args) : fileStore.appendLtvSample(...args);
}

export async function listLtvSamples(...args: Parameters<typeof fileStore.listLtvSamples>) {
  return isDatabaseMode() ? dbStore.listLtvSamples(...args) : fileStore.listLtvSamples(...args);
}

export async function readPredictiveLtvModel(...args: Parameters<typeof fileStore.readPredictiveLtvModel>) {
  return isDatabaseMode() ? dbStore.readPredictiveLtvModel(...args) : fileStore.readPredictiveLtvModel(...args);
}

export async function writePredictiveLtvModel(...args: Parameters<typeof fileStore.writePredictiveLtvModel>) {
  return isDatabaseMode() ? dbStore.writePredictiveLtvModel(...args) : fileStore.writePredictiveLtvModel(...args);
}

