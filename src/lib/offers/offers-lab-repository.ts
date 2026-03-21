import * as fileStore from "@/lib/offers/offers-lab-store";
import * as dbStore from "@/lib/offers/offers-lab-db";

function isDatabaseMode() {
  return process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
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

export async function listTrafficEvents(...args: Parameters<typeof fileStore.listTrafficEvents>) {
  return isDatabaseMode() ? dbStore.listTrafficEvents(...args) : fileStore.listTrafficEvents(...args);
}

export async function readSyncState(...args: Parameters<typeof fileStore.readSyncState>) {
  return isDatabaseMode() ? dbStore.readSyncState(...args) : fileStore.readSyncState(...args);
}

export async function writeSyncState(...args: Parameters<typeof fileStore.writeSyncState>) {
  return isDatabaseMode() ? dbStore.writeSyncState(...args) : fileStore.writeSyncState(...args);
}

