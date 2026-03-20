export const WAR_ROOM_OPS_CONSTANTS = {
  scale: {
    targetEventsPerDay: 50_000,
    ceoStressAdSpendPerDay: 500_000,
  },
  thresholds: {
    mer: {
      sirenCritical: 2.0,
      operationalCritical: 2.5,
      scale: 4.0,
    },
    pixel: {
      maxDiscrepancyPct: 20,
    },
    appmax: {
      approvalDropAlertPct: 15,
      approvalLowPct: 80,
    },
  },
  vault: {
    checkIntervalMinutes: 30,
    maxDomainsPerCycle: 20,
  },
  naming: {
    maxLevenshteinDistance: 2,
  },
  predictiveLtv: {
    baseGrowthFromD7: 2.25,
    weights: {
      appmaxApproval: 0.25,
      upsellTakeRate: 0.2,
      crmShare: 0.15,
      pixelHealthPenalty: -0.2,
      abandonmentPenalty: -0.15,
    },
    confidence: {
      min: 45,
      max: 92,
    },
  },
} as const;
