export type SquadKey = "facebook" | "googleYoutube" | "tiktok";
export type TrafficSourceKey = "meta" | "google" | "native";

export type PipelineStage = "Roteiro" | "Gravacao" | "Edicao" | "Teste" | "Winner";

export type DailyReplyRole = "Copy" | "Edicao";

export type WarRoomDataSource = "mock" | "api" | "sheet" | "database" | "fallback";

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
