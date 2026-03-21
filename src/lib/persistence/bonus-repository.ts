import * as fileStore from "@/lib/persistence/bonus-store";
import * as dbStore from "@/lib/persistence/bonus-db";

function isDatabaseMode() {
  const enabled = process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
  const mustUseDatabase =
    process.env.NODE_ENV === "production" && process.env.WAR_ROOM_REQUIRE_DATABASE_IN_PROD === "true";
  if (mustUseDatabase && !enabled) {
    throw new Error(
      "Persistencia em banco obrigatoria para modulo de bonificacao em producao. Configure WAR_ROOM_OPS_PERSISTENCE_MODE=database e DATABASE_URL.",
    );
  }
  return enabled;
}

export async function readBonusSettings(...args: Parameters<typeof fileStore.readBonusSettings>) {
  return isDatabaseMode() ? dbStore.readBonusSettings(...args) : fileStore.readBonusSettings(...args);
}

export async function writeBonusSettings(...args: Parameters<typeof fileStore.writeBonusSettings>) {
  return isDatabaseMode() ? dbStore.writeBonusSettings(...args) : fileStore.writeBonusSettings(...args);
}

export async function listMonthlyProfitRows(...args: Parameters<typeof fileStore.listMonthlyProfitRows>) {
  return isDatabaseMode() ? dbStore.listMonthlyProfitRows(...args) : fileStore.listMonthlyProfitRows(...args);
}

export async function listBonusSnapshots(...args: Parameters<typeof fileStore.listBonusSnapshots>) {
  return isDatabaseMode() ? dbStore.listBonusSnapshots(...args) : fileStore.listBonusSnapshots(...args);
}

export async function insertBonusSnapshotsIfMissing(...args: Parameters<typeof fileStore.insertBonusSnapshotsIfMissing>) {
  return isDatabaseMode()
    ? dbStore.insertBonusSnapshotsIfMissing(...args)
    : fileStore.insertBonusSnapshotsIfMissing(...args);
}

export async function listBonusApprovals(...args: Parameters<typeof fileStore.listBonusApprovals>) {
  return isDatabaseMode() ? dbStore.listBonusApprovals(...args) : fileStore.listBonusApprovals(...args);
}

export async function appendBonusApproval(...args: Parameters<typeof fileStore.appendBonusApproval>) {
  return isDatabaseMode() ? dbStore.appendBonusApproval(...args) : fileStore.appendBonusApproval(...args);
}

