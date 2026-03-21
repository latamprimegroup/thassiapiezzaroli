import * as fileStore from "@/lib/persistence/lead-intelligence-store";
import * as dbStore from "@/lib/persistence/lead-intelligence-db";

export type {
  LeadEventType,
  LeadEventRecord,
  ChurnPlaybookAction,
  TriggerPerformanceRecord,
  RoutingRule,
} from "@/lib/persistence/lead-intelligence-store";

function isDatabaseMode() {
  const enabled = process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
  const mustUseDatabase =
    process.env.NODE_ENV === "production" && process.env.WAR_ROOM_REQUIRE_DATABASE_IN_PROD === "true";
  if (mustUseDatabase && !enabled) {
    throw new Error(
      "Persistencia em banco obrigatoria em producao para Lead Intelligence. Configure WAR_ROOM_OPS_PERSISTENCE_MODE=database e DATABASE_URL.",
    );
  }
  return enabled;
}

export async function listLeadEvents(...args: Parameters<typeof fileStore.listLeadEvents>) {
  return isDatabaseMode() ? dbStore.listLeadEvents(...args) : fileStore.listLeadEvents(...args);
}

export async function appendLeadEvents(...args: Parameters<typeof fileStore.appendLeadEvents>) {
  return isDatabaseMode() ? dbStore.appendLeadEvents(...args) : fileStore.appendLeadEvents(...args);
}

export async function listPlaybookActions(...args: Parameters<typeof fileStore.listPlaybookActions>) {
  return isDatabaseMode() ? dbStore.listPlaybookActions(...args) : fileStore.listPlaybookActions(...args);
}

export async function appendPlaybookAction(...args: Parameters<typeof fileStore.appendPlaybookAction>) {
  return isDatabaseMode() ? dbStore.appendPlaybookAction(...args) : fileStore.appendPlaybookAction(...args);
}

export async function listTriggerPerformance(...args: Parameters<typeof fileStore.listTriggerPerformance>) {
  return isDatabaseMode() ? dbStore.listTriggerPerformance(...args) : fileStore.listTriggerPerformance(...args);
}

export async function appendTriggerPerformance(...args: Parameters<typeof fileStore.appendTriggerPerformance>) {
  return isDatabaseMode() ? dbStore.appendTriggerPerformance(...args) : fileStore.appendTriggerPerformance(...args);
}

export async function listRoutingRules(...args: Parameters<typeof fileStore.listRoutingRules>) {
  return isDatabaseMode() ? dbStore.listRoutingRules(...args) : fileStore.listRoutingRules(...args);
}

export async function upsertRoutingRule(...args: Parameters<typeof fileStore.upsertRoutingRule>) {
  return isDatabaseMode() ? dbStore.upsertRoutingRule(...args) : fileStore.upsertRoutingRule(...args);
}

export async function updateRoutingRule(...args: Parameters<typeof fileStore.updateRoutingRule>) {
  return isDatabaseMode() ? dbStore.updateRoutingRule(...args) : fileStore.updateRoutingRule(...args);
}
