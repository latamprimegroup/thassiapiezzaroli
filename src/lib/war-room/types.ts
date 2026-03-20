export type SquadKey = "facebook" | "googleYoutube" | "tiktok";
export type TrafficSourceKey = "meta" | "google" | "native";

export type PipelineStage = "Roteiro" | "Gravacao" | "Edicao" | "Teste" | "Winner";

export type DailyReplyRole = "Copy" | "Edicao";

export type WarRoomDataSource = "mock" | "api" | "sheet" | "database" | "fallback";
export type DemandDepartment = "copyResearch" | "trafficMedia" | "editorsCreative" | "techCro";
export type DemandStatus = "backlog" | "doing" | "review" | "done";
export type FinancialImpact = "low" | "medium" | "high" | "critical";
export type VaultStatus = "ok" | "warning" | "blocked";
export type PixelSyncStatus = "healthy" | "unhealthy" | "no_data";
export type CreativeFormat = "VSL" | "UGC" | "ADVERT" | "REELS";

export type SquadSyncKpiSnapshot = {
  hookRate: number;
  holdRate15s: number;
  ctrOutbound: number;
  icRate: number;
  frequency: number;
};

export type SquadSyncCommandOrder = {
  id: string;
  audience: "editors" | "copywriters" | "mediaBuyers" | "techCro" | "ceoFinance";
  status: "winner" | "scaling" | "failing";
  title: string;
  diagnosis: string;
  action: string;
  createdAt: string;
};

export type ProviderSyncStatus = "online" | "syncing" | "error";

export type WarRoomData = {
  source: WarRoomDataSource;
  sourceLabel: string;
  updatedAt: string;
  globalOverview: {
    investment: number;
    revenue: number;
    utmifySyncAt: string;
    trafficSources: Array<{
      source: string;
      spend: number;
    }>;
  };

  squads: Record<
    SquadKey,
    {
      name: string;
      focus: string;
      creativeVelocity: number;
      creativeVelocityTarget: number;
      validatedCreatives: number;
      managerComment: string;
    }
  >;

  liveAdsTracking: Array<{
    id: string;
    squad: SquadKey;
    campaign: string;
    adName: string;
    impressions: number;
    clicks: number;
    views3s: number;
    views15s: number;
    ic: number;
    lp: number;
    roas: number;
    frequency: number;
    uniqueCtr: number;
    aov: number;
    upsellConversion: number;
    ltv: number;
    cpa: number;
    trend24h: {
      hookRate: number[];
      holdRate: number[];
      roas: number[];
    };
    frequencyTrend3d: number[];
    uniqueCtrTrend3d: number[];
  }>;

  creativeFactory: {
    tasks: Array<{
      id: string;
      squad: SquadKey;
      title: string;
      owner: string;
      status: PipelineStage;
      metricContext: string;
      updatedAt: string;
    }>;
  };

  dailyBriefing: Array<{
    id: string;
    squad: SquadKey;
    trafficManagerComment: string;
    replies: Array<{
      role: DailyReplyRole;
      author: string;
      version: string;
      assetUrl: string;
      note: string;
    }>;
  }>;
  commandCenter: {
    tasks: Array<{
      id: string;
      department: DemandDepartment;
      title: string;
      description: string;
      squadHead: string;
      assignee: string;
      status: DemandStatus;
      impact: FinancialImpact;
      createdAt: string;
      lastMovedAt: string;
      dueAt: string;
      dependencyIds: string[];
      doneApproval: {
        required: boolean;
        approved: boolean;
        approvedBy: string;
        approvedRole: string;
        approvedAt: string;
        note: string;
      };
      decisionLog: Array<{
        at: string;
        author: string;
        note: string;
      }>;
    }>;
    squadMembers: Record<DemandDepartment, string[]>;
  };

  finance: {
    netRevenue: number;
    profitMargin: number;
    contributionMargin: number;
    approvalRate: number;
    approvalCard: number;
    approvalPix: number;
    ltv24h: number;
    upsellTakeRate: number;
    ltv: number;
  };
  squadSync: {
    lastReportAt: string;
    dailyInput: {
      creativeId: string;
      kpisToday: SquadSyncKpiSnapshot;
      kpisYesterday: SquadSyncKpiSnapshot;
      sentimentNotes: string;
    };
    commandOrders: SquadSyncCommandOrder[];
    notifications: {
      lastDispatchAt: string;
      lastMessage: string;
      slackStatus: "idle" | "sent" | "simulated" | "failed";
      whatsappStatus: "idle" | "sent" | "simulated" | "failed";
    };
  };
  integrations: {
    apiStatus: {
      utmify: {
        status: ProviderSyncStatus;
        lastSync: string;
        trend12h: number[];
        errorMessage: string;
      };
      appmax: {
        status: ProviderSyncStatus;
        lastSync: string;
        trend12h: number[];
        errorMessage: string;
      };
      kiwify: {
        status: ProviderSyncStatus;
        lastSync: string;
        trend12h: number[];
        errorMessage: string;
      };
      yampi: {
        status: ProviderSyncStatus;
        lastSync: string;
        trend12h: number[];
        errorMessage: string;
      };
    };
    attribution: {
      realRoiLeaderboard: Array<{
        creativeId: string;
        source: TrafficSourceKey;
        realProfit: number;
        realRoas: number;
      }>;
      validatedAssets: Array<{
        assetId: string;
        inputCpa: number;
        effectiveCpa: number;
        status: "scale" | "stabilize" | "pause";
        trackingSource: "facebookApi" | "utmifyClickToPurchase";
        note: string;
        salesVolumeShare: number;
      }>;
    };
    gateway: {
      consolidatedGrossRevenue: number;
      consolidatedNetRevenue: number;
      appmaxCardApprovalRate: number;
      appmaxPreviousDayApprovalRate: number;
      yampiCartAbandonmentRate: number;
      fixedCosts: number;
      taxRatePct: number;
      kiwifyUpsellTakeRates: {
        upsell1: number;
        upsell2: number;
        upsell3: number;
      };
    };
    merCross: {
      value: number;
      totalSpend: number;
      status: "critical" | "stable" | "elite";
      trend12h: number[];
      recommendation: string;
    };
    fortress: {
      vault: {
        lastCheckAt: string;
        intervalMinutes: number;
        overallStatus: VaultStatus;
        domains: Array<{
          domain: string;
          safeBrowsingStatus: "safe" | "unsafe" | "unknown";
          facebookDebuggerStatus: "ok" | "warning" | "down" | "unknown";
          blacklistHits: number;
          status: VaultStatus;
          note: string;
          checkedAt: string;
        }>;
      };
      pixelSync: {
        realPurchases: number;
        metaReportedPurchases: number;
        discrepancyPct: number;
        status: PixelSyncStatus;
        lastCheckAt: string;
        note: string;
      };
      backEndLtv: {
        upsellFlowMap: Array<{
          step: string;
          takeRate: number;
          estimatedRevenue: number;
          status: "scale" | "attention";
        }>;
        revenueBySource: {
          paidTraffic: number;
          crmEmail: number;
          crmSms: number;
          crmWhatsapp: number;
          crmTotal: number;
          total: number;
          crmSharePct: number;
        };
        ltvTracker: {
          d7: number;
          d30: number;
          d90: number;
        };
        cohort90d: Array<{
          cohortLabel: string;
          projectedRevenue: number;
          source: "paid" | "crm";
        }>;
      };
      scaleSimulator: {
        defaultAdSpend: number;
        defaultCpa: number;
        projectedPurchases: number;
        projectedNetProfit: number;
        roiPct: number;
      };
      executiveBriefing: {
        generatedAt: string;
        summary: string;
        suggestedAction: string;
      };
      siren: {
        active: boolean;
        reasons: string[];
        severity: "normal" | "critical";
      };
    };
  };
  contingency: {
    domains: Array<{
      name: string;
      status: "ok" | "warning" | "blocked";
      score: number;
      lastCheck: string;
    }>;
    adAccounts: Array<{
      name: string;
      status: "ok" | "warning" | "blocked";
      score: number;
      lastCheck: string;
    }>;
    fanpages: Array<{
      name: string;
      status: "ok" | "warning" | "blocked";
      score: number;
      lastCheck: string;
    }>;
  };
  enterprise: {
    ceoFinance: {
      grossRevenue: number;
      adSpend: number;
      gatewayFees: number;
      nfseTaxes: number;
      netProfit: number;
      mer: number;
      ltvCohorts: {
        d30: number;
        d60: number;
        d90: number;
      };
      paybackDays: number;
      taxProvision: number;
      recoveryLeaderboard: Array<{
        agent: string;
        boletoRecoveryRate: number;
        pixRecoveryRate: number;
        recoveredRevenue: number;
      }>;
    };
    copyResearch: {
      uniqueMechanismProblem: string;
      uniqueMechanismSolution: string;
      bigIdeaVault: Array<{
        id: string;
        title: string;
        saturation: number;
        expiresAt: string;
      }>;
      avatarDossier: Array<{
        pain: string;
        desire: string;
        objection: string;
        supportInsight: string;
      }>;
      namingRegistry: Array<{
        id: string;
        product: string;
        bigIdea: string;
        mechanism: string;
        format: CreativeFormat;
        hookVariation: string;
        uniqueId: string;
        dnaName: string;
        linkedCreativeId: string;
        createdAt: string;
        active: boolean;
      }>;
      scriptEditor: string;
    };
    trafficAttribution: {
      squads: Record<
        TrafficSourceKey,
        {
          targetCpa: number;
          currentCpa: number;
          roas: number;
          stability48h: number;
        }
      >;
      deepAttribution: Array<{
        creativeId: string;
        source: TrafficSourceKey;
        netProfit: number;
        ltv: number;
      }>;
      scaleCalculator: {
        suggestedIncreasePct: number;
        reason: string;
      };
    };
    editorsProduction: {
      hookLibrary: Array<{
        hook: string;
        creativeId: string;
        hookRate: number;
      }>;
      retentionHeatmap: Array<{
        second: number;
        dropOff: number;
      }>;
      patternInterruptChecklist: {
        every3s: boolean;
        soundDesign: boolean;
        vfx: boolean;
      };
    };
    techCro: {
      lcpSeconds: number;
      abTests: Array<{
        test: string;
        variantA: number;
        variantB: number;
        winner: string;
      }>;
      checkout: {
        cartAbandonment: number;
        checkoutConversion: number;
        gatewayAlert: boolean;
      };
      upsellFlow: Array<{
        step: string;
        clickRate: number;
      }>;
    };
  };
  activityLog: Array<{
    id: string;
    actorRole: string;
    actorName: string;
    action: string;
    entity: string;
    reason: string;
    timestamp: string;
  }>;
  oldSchema?: {
    ads?: {
      investmentTotal?: number;
      avgRoas?: number;
      avgCpm?: number;
      creatives?: Array<{
        id: string;
        hookRate: number;
        holdRate: number;
        roas: number;
      }>;
    };
    copy?: {
      angles?: string[];
      hooksBacklog?: string[];
      productionFlow?: {
        roteirizando?: string[];
        gravando?: string[];
        editando?: string[];
      };
    };
    tech?: {
      pageLoadDropOff?: number;
      pageLoadNote?: string;
      vslRetention?: number;
      vslNote?: string;
      checkoutConversion?: number;
      checkoutNote?: string;
    };
    finance?: {
      revenue?: number;
      netRevenue?: number;
      profitMargin?: number;
      approvalRate?: number;
      ltv?: number;
    };
  };
};
