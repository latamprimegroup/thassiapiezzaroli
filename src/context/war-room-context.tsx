"use client";

import { createContext, useContext } from "react";
import { safeDivide } from "@/lib/metrics/kpis";
import type { SquadSyncCommandOrder, SquadSyncKpiSnapshot, TrafficSourceKey, WarRoomData } from "@/lib/war-room/types";

type WarRoomContextValue = {
  data: WarRoomData;
  updateTrafficCpa: (source: TrafficSourceKey, newValue: number) => void;
  updateBoardroomFinanceConfig: (payload: { fixedCosts: number; taxRatePct: number }) => void;
  addActivity: (actorRole: string, actorName: string, action: string, entity: string, reason: string) => void;
  applySquadSyncFeedback: (payload: {
    creativeId: string;
    kpisToday: SquadSyncKpiSnapshot;
    kpisYesterday: SquadSyncKpiSnapshot;
    sentimentNotes: string;
    commandOrders: SquadSyncCommandOrder[];
  }) => void;
  registerCreativeNaming: (entry: WarRoomData["enterprise"]["copyResearch"]["namingRegistry"][number]) => void;
};

export const WarRoomContext = createContext<WarRoomContextValue | null>(null);

export function useWarRoom() {
  const context = useContext(WarRoomContext);
  if (!context) {
    throw new Error("useWarRoom deve ser usado dentro de WarRoomContext.Provider");
  }
  return context;
}

// Senior-only note:
// This helper centralizes financial recalculation so every CPA input from traffic
// instantly propagates to CEO cash metrics (single source of truth).
export function recalculateEnterpriseFinance(data: WarRoomData): WarRoomData {
  const base = data.enterprise.ceoFinance;
  const squads = data.enterprise.trafficAttribution.squads;
  const fixedCosts = Math.max(0, data.integrations.gateway.fixedCosts || 0);
  const taxRatePct = Math.max(0, data.integrations.gateway.taxRatePct || 0);

  const pressureMeta = safeDivide(squads.meta.currentCpa, squads.meta.targetCpa);
  const pressureGoogle = safeDivide(squads.google.currentCpa, squads.google.targetCpa);
  const pressureNative = safeDivide(squads.native.currentCpa, squads.native.targetCpa);
  const pressure = (pressureMeta + pressureGoogle + pressureNative) / 3 || 1;

  const adjustedAdSpend = base.adSpend * pressure;
  const nfseTaxes = base.grossRevenue * (taxRatePct / 100);
  const netProfit = Math.max(0, base.grossRevenue - adjustedAdSpend - base.gatewayFees - nfseTaxes - fixedCosts);
  const mer = safeDivide(base.grossRevenue, adjustedAdSpend);
  const paybackDays = Math.max(1, Math.round(safeDivide(adjustedAdSpend, safeDivide(base.grossRevenue, 30))));

  data.enterprise.ceoFinance.nfseTaxes = nfseTaxes;
  data.enterprise.ceoFinance.taxProvision = nfseTaxes;
  data.enterprise.ceoFinance.netProfit = netProfit;
  data.enterprise.ceoFinance.mer = mer;
  data.enterprise.ceoFinance.paybackDays = paybackDays;
  data.finance.netRevenue = netProfit;
  return data;
}
