import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OfferRecord, OffersLabSyncState, TrafficEventRecord } from "@/lib/offers/types";

type OffersLabStorePayload = {
  offers: OfferRecord[];
  trafficEvents: TrafficEventRecord[];
  sync: OffersLabSyncState;
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "offers-lab-store.json");

declare global {
  var __offersLabStoreLock: Promise<void> | undefined;
}

function defaultSyncState(): OffersLabSyncState {
  return {
    lastSyncAt: "",
    lastStatus: "idle",
    lastMessage: "",
  };
}

function defaultStore(): OffersLabStorePayload {
  return {
    offers: [],
    trafficEvents: [],
    sync: defaultSyncState(),
  };
}

async function ensureStoreDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore(): Promise<OffersLabStorePayload> {
  await ensureStoreDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<OffersLabStorePayload>;
    return {
      offers: Array.isArray(parsed.offers) ? parsed.offers : [],
      trafficEvents: Array.isArray(parsed.trafficEvents) ? parsed.trafficEvents : [],
      sync:
        parsed.sync && typeof parsed.sync === "object"
          ? {
              lastSyncAt: typeof parsed.sync.lastSyncAt === "string" ? parsed.sync.lastSyncAt : "",
              lastStatus:
                parsed.sync.lastStatus === "ok" || parsed.sync.lastStatus === "error" || parsed.sync.lastStatus === "idle"
                  ? parsed.sync.lastStatus
                  : "idle",
              lastMessage: typeof parsed.sync.lastMessage === "string" ? parsed.sync.lastMessage : "",
            }
          : defaultSyncState(),
    };
  } catch {
    return defaultStore();
  }
}

async function writeStore(payload: OffersLabStorePayload) {
  await ensureStoreDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withStoreMutation<T>(mutator: (store: OffersLabStorePayload) => T | Promise<T>): Promise<T> {
  const previous = globalThis.__offersLabStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__offersLabStoreLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return result;
  } finally {
    release();
  }
}

export async function readOffer(offerId: string) {
  const store = await readStore();
  return store.offers.find((offer) => offer.id === offerId) ?? null;
}

export async function listOffers() {
  const store = await readStore();
  return [...store.offers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertOffer(record: OfferRecord) {
  return withStoreMutation((store) => {
    const index = store.offers.findIndex((offer) => offer.id === record.id);
    if (index >= 0) {
      store.offers[index] = record;
    } else {
      store.offers.unshift(record);
    }
    store.offers = store.offers.slice(0, 5_000);
    return record;
  });
}

export async function appendTrafficEvent(event: TrafficEventRecord) {
  return withStoreMutation((store) => {
    const alreadyExists = store.trafficEvents.some((row) => row.id === event.id);
    if (!alreadyExists) {
      store.trafficEvents.unshift(event);
      store.trafficEvents = store.trafficEvents.slice(0, 200_000);
    }
    return event;
  });
}

export async function appendTrafficEventsBatch(events: TrafficEventRecord[]) {
  return withStoreMutation((store) => {
    const existingIds = new Set(store.trafficEvents.map((row) => row.id));
    let inserted = 0;
    for (const event of events) {
      if (existingIds.has(event.id)) {
        continue;
      }
      store.trafficEvents.unshift(event);
      existingIds.add(event.id);
      inserted += 1;
    }
    store.trafficEvents = store.trafficEvents.slice(0, 200_000);
    return {
      inserted,
      attempted: events.length,
    };
  });
}

export async function listTrafficEvents(params?: {
  offerId?: string;
  sinceIso?: string;
  eventType?: TrafficEventRecord["eventType"];
  limit?: number;
}) {
  const store = await readStore();
  const limit = params?.limit ?? 100_000;
  return store.trafficEvents
    .filter((event) => (params?.offerId ? event.offerId === params.offerId : true))
    .filter((event) => (params?.eventType ? event.eventType === params.eventType : true))
    .filter((event) => (params?.sinceIso ? event.occurredAt >= params.sinceIso : true))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

export async function readSyncState() {
  const store = await readStore();
  return store.sync;
}

export async function writeSyncState(state: OffersLabSyncState) {
  return withStoreMutation((store) => {
    store.sync = state;
    return state;
  });
}

