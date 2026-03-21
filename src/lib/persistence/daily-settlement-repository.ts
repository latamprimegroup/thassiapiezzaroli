import * as fileStore from "@/lib/persistence/daily-settlement-store";
import * as dbStore from "@/lib/persistence/daily-settlement-db";

export type { DailySettlementRecord } from "@/lib/persistence/daily-settlement-store";

function isDatabaseMode() {
  const enabled = process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
  const mustUseDatabase =
    process.env.NODE_ENV === "production" && process.env.WAR_ROOM_REQUIRE_DATABASE_IN_PROD === "true";
  if (mustUseDatabase && !enabled) {
    throw new Error(
      "Persistencia em banco obrigatoria para Daily Settlement em producao. Configure WAR_ROOM_OPS_PERSISTENCE_MODE=database e DATABASE_URL.",
    );
  }
  return enabled;
}

export async function listDailySettlements(...args: Parameters<typeof fileStore.listDailySettlements>) {
  return isDatabaseMode() ? dbStore.listDailySettlements(...args) : fileStore.listDailySettlements(...args);
}

export async function getDailySettlementByUserDate(...args: Parameters<typeof fileStore.getDailySettlementByUserDate>) {
  return isDatabaseMode() ? dbStore.getDailySettlementByUserDate(...args) : fileStore.getDailySettlementByUserDate(...args);
}

export async function upsertDailySettlement(...args: Parameters<typeof fileStore.upsertDailySettlement>) {
  return isDatabaseMode() ? dbStore.upsertDailySettlement(...args) : fileStore.upsertDailySettlement(...args);
}

