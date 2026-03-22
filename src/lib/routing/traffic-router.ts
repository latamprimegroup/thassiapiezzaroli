import type { WarRoomData } from "@/lib/war-room/types";
import {
  listRoutingRules,
  updateRoutingRule,
  upsertRoutingRule,
  type RoutingRule,
} from "@/lib/persistence/lead-intelligence-repository";

export type ResolvedRoute = {
  offerId: string;
  activeUrl: string;
  mode: RoutingRule["mode"];
  reason: string;
  lastSwitchAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeOfferId(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "global";
}

async function ensureBaseRouting() {
  const rules = await listRoutingRules();
  if (rules.length > 0) {
    return rules;
  }
  const base: RoutingRule = {
    id: "ROUTE-GLOBAL",
    offerId: "global",
    primaryUrl: "https://oferta.exemplo/landing",
    backupUrls: ["https://backup1.exemplo/landing", "https://backup2.exemplo/landing"],
    activeUrl: "https://oferta.exemplo/landing",
    mode: "primary",
    reason: "estado inicial",
    lastSwitchAt: nowIso(),
  };
  await upsertRoutingRule(base);
  return [base];
}

export async function getRoutingStatus() {
  return ensureBaseRouting();
}

export async function resolveTrafficRoute(offerId: string) {
  const normalizedOfferId = normalizeOfferId(offerId);
  const rules = await ensureBaseRouting();
  const exact = rules.find((rule) => rule.offerId === normalizedOfferId);
  const globalRule = rules.find((rule) => rule.offerId === "global");
  const chosen = exact ?? globalRule ?? rules[0];
  return {
    offerId: normalizedOfferId,
    activeUrl: chosen.activeUrl,
    mode: chosen.mode,
    reason: chosen.reason,
    lastSwitchAt: chosen.lastSwitchAt,
  } satisfies ResolvedRoute;
}

export async function switchRoute(params: {
  offerId: string;
  targetUrl: string;
  mode: RoutingRule["mode"];
  reason: string;
}) {
  const normalizedOfferId = normalizeOfferId(params.offerId);
  const rules = await ensureBaseRouting();
  const existing = rules.find((rule) => rule.offerId === normalizedOfferId) ?? rules.find((rule) => rule.offerId === "global");
  if (!existing) {
    return null;
  }
  const updated = await updateRoutingRule(existing.id, {
    offerId: normalizedOfferId,
    activeUrl: params.targetUrl,
    mode: params.mode,
    reason: params.reason,
  });
  return updated;
}

export async function applyAutomaticRoutingFromSignals(data: WarRoomData) {
  const rules = await ensureBaseRouting();
  const global = rules.find((rule) => rule.offerId === "global") ?? rules[0];
  if (!global) {
    return null;
  }

  const domainBlocked = data.integrations.fortress.vault.overallStatus === "blocked";
  const checkoutCritical = data.enterprise.techCro.checkout.cartAbandonment > 65;
  const triggerAutoFailover = domainBlocked || checkoutCritical;

  if (triggerAutoFailover) {
    const backup = global.backupUrls.find((url) => url !== global.activeUrl) ?? global.backupUrls[0] ?? global.activeUrl;
    if (backup !== global.activeUrl || global.mode !== "failover_auto") {
      return updateRoutingRule(global.id, {
        activeUrl: backup,
        mode: "failover_auto",
        reason: domainBlocked
          ? "auto-failover: dominio principal em status blocked no Fortress."
          : "auto-failover: checkout critico por abandono > 65%.",
      });
    }
    return global;
  }

  if (global.mode === "failover_auto" && global.activeUrl !== global.primaryUrl) {
    return updateRoutingRule(global.id, {
      activeUrl: global.primaryUrl,
      mode: "primary",
      reason: "retorno automatico ao dominio principal apos normalizacao dos sinais.",
    });
  }

  return global;
}
