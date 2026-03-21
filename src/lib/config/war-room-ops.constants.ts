export const WAR_ROOM_OPS_CONSTANTS = {
  scale: {
    targetEventsPerDay: 50_000,
    ceoStressAdSpendPerDay: 500_000,
  },
  performance: {
    dashboardRefreshMs: 60_000,
    executiveSnapshotTtlSeconds: 20,
    maxLiveCreativesBeforeVirtualization: 1_000,
    scatterPoints24hLimit: 1_500,
  },
  queue: {
    webhook: {
      maxRetryAttempts: 4,
      maxBackoffMinutes: 60,
      retryBaseMinutes: 2,
      enqueueWorkerKickBatchSize: 10,
      retryScanBatchSize: 50,
      deadLetterListBatchSize: 25,
    },
    worker: {
      defaultBatchSize: 50,
      observabilityBatchSize: 25,
      maxBatchSize: 200,
      followupRetryBatchFloor: 10,
    },
    store: {
      maxWebhookEvents: 2_000,
      maxJobs: 10_000,
      maxApprovals: 2_000,
    },
  },
  thresholds: {
    mer: {
      sirenCritical: 2.0,
      operationalCritical: 2.5,
      scale: 4.0,
    },
    killSwitch: {
      merCritical: 1.8,
      peakStartHour: 8,
      peakEndHour: 23,
      durationMinutes: 120,
    },
    upsell: {
      attachRateBenchmarkPct: 20,
    },
    pixel: {
      maxDiscrepancyPct: 20,
    },
    appmax: {
      approvalDropAlertPct: 15,
      approvalLowPct: 80,
    },
    yampi: {
      abandonmentCriticalPct: 60,
    },
    testLab: {
      approvedHookRatePct: 25,
      hookFailureRatePct: 15,
      highCtrOutboundPct: 1.2,
      minSpendMultiplier: 1,
      maxSpendMultiplier: 2,
      fatigueRiskHours: 72,
      minReadyToUploadQueue: 1,
    },
  },
  observability: {
    slo: {
      apiP95LatencyMs: 350,
      webhookIngestP95LatencyMs: 800,
      queueDrainP95Minutes: 5,
      mttrMinutesTarget: 20,
      maxErrorRatePct: 1,
    },
    alerting: {
      dedupeWindowMinutes: 15,
      escalationMinutes: {
        warning: 10,
        critical: 3,
      },
      channels: ["slack", "whatsapp", "push"] as const,
    },
    incidents: {
      historyRetentionDays: 30,
      maxRecentItems: 25,
      deadLetterIncidentThreshold: 1,
      squadSlaMinutes: {
        techCro: 20,
        trafficMedia: 30,
        copyResearch: 90,
        ceoFinance: 45,
        platform: 30,
      },
    },
  },
  vault: {
    checkIntervalMinutes: 30,
    maxDomainsPerCycle: 20,
    healthScoreWeights: {
      safeBrowsing: 0.45,
      cloudflare: 0.35,
      facebookDebugger: 0.2,
    },
    healthScoreThresholds: {
      blocked: 45,
      warning: 75,
    },
  },
  naming: {
    maxLevenshteinDistance: 2,
    autoCorrectionConfidenceMin: 0.9,
    maxAliasesPerCreative: 5,
  },
  attribution: {
    reconciliation: {
      spendVarianceWarningPct: 5,
      grossVarianceWarningPct: 3,
      profitVarianceCriticalPct: 2,
    },
  },
  experimentation: {
    alpha: 0.05,
    power: 0.8,
    defaultMdePct: 12,
    minSamplePerVariant: 500,
    sequentialPeekIntervalMinutes: 60,
    stopRules: {
      minRuntimeHours: 24,
      maxRuntimeDays: 7,
      earlyStopPosteriorWinProb: 0.95,
    },
  },
  governance: {
    bigIdeaVersioningRequired: true,
    maxUnapprovedHours: 12,
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
    training: {
      retrainCadenceHours: 24,
      minCohortsForTraining: 30,
      holdoutPct: 0.2,
    },
  },
  offersLab: {
    syncIntervalMinutes: 15,
    cacheTtlSeconds: 30,
    callbackMaxPayloadBytes: 1024 * 1024,
    maxBatchEventsPerRequest: 500,
    callbackRateLimitPerMinute: 1_500,
    redis: {
      keyPrefix: "warroom:offerslab",
    },
    validation: {
      minRevenue7d: 70_000,
      minRoas: 1.8,
    },
    attributionGovernance: {
      strictMode: true,
      quarantineListLimit: 100,
    },
    predictiveLtv: {
      minSamplesForTraining: 25,
      retrainEverySync: true,
      driftWarningRatio: 1.35,
      driftCriticalRatio: 1.8,
    },
    trafficSources: ["meta", "google", "tiktok", "kwai", "networking", "unknown"] as const,
  },
} as const;
