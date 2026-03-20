import { mockWarRoomData } from "./mock-data";
import type { DailyReplyRole, PipelineStage, SquadKey, TrafficSourceKey, WarRoomData } from "./types";

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function toObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : fallback;
}

function toNumberArray(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((item) => toNumber(item, Number.NaN))
    .filter((item) => Number.isFinite(item));
  return normalized.length > 0 ? normalized : fallback;
}

function toSquad(value: unknown, fallback: SquadKey): SquadKey {
  return value === "facebook" || value === "googleYoutube" || value === "tiktok" ? value : fallback;
}

function toTrafficSource(value: unknown, fallback: TrafficSourceKey): TrafficSourceKey {
  return value === "meta" || value === "google" || value === "native" ? value : fallback;
}

function toStage(value: unknown, fallback: PipelineStage): PipelineStage {
  if (value === "Roteiro" || value === "Gravacao" || value === "Edicao" || value === "Teste" || value === "Winner") {
    return value;
  }
  return fallback;
}

function toReplyRole(value: unknown, fallback: DailyReplyRole): DailyReplyRole {
  return value === "Copy" || value === "Edicao" ? value : fallback;
}

function toStatus(value: unknown, fallback: "ok" | "warning" | "blocked") {
  return value === "ok" || value === "warning" || value === "blocked" ? value : fallback;
}

function deriveLegacyLiveRows(value: unknown): WarRoomData["liveAdsTracking"] {
  const input = toObject(value);
  const adsInput = toObject(input.ads);
  const creativesInput = Array.isArray(adsInput.creatives) ? adsInput.creatives : [];

  return creativesInput.map((item, index) => {
    const row = toObject(item);
    const hookRate = toNumber(row.hookRate, 0);
    const holdRate = toNumber(row.holdRate, 0);
    const impressions = 85_000 + index * 14_500;
    const views3s = Math.round(impressions * (hookRate / 100));
    const views15s = Math.round(views3s * (holdRate / 100));
    const lp = 3_200 + index * 380;
    const ic = Math.round(lp * (0.14 + Math.min(toNumber(row.roas, 2) * 0.03, 0.14)));

    const roas = toNumber(row.roas, 1.5);

    return {
      id: toString(row.id, `LEG-${index + 1}`),
      squad: index % 2 === 0 ? "facebook" : "googleYoutube",
      campaign: index % 2 === 0 ? "Legacy Facebook" : "Legacy Google/YouTube",
      adName: `Criativo legado ${index + 1}`,
      impressions,
      clicks: Math.round(impressions * 0.065),
      views3s,
      views15s,
      ic,
      lp,
      roas,
      frequency: toNumber(row.frequency, 1.5 + index * 0.2),
      uniqueCtr: toNumber(row.uniqueCtr, Math.max(0.5, 2.2 - index * 0.1)),
      aov: toNumber(row.aov, 300 + index * 15),
      upsellConversion: toNumber(row.upsellConversion, 12 + index * 1.2),
      ltv: toNumber(row.ltv, 1500 + index * 120),
      cpa: toNumber(row.cpa, 140 + index * 10),
      trend24h: {
        hookRate: [hookRate - 1, hookRate - 0.5, hookRate],
        holdRate: [holdRate + 1, holdRate + 0.4, holdRate],
        roas: [roas - 0.1, roas - 0.05, roas],
      },
      frequencyTrend3d: [1.2 + index * 0.2, 1.4 + index * 0.2, 1.6 + index * 0.2],
      uniqueCtrTrend3d: [2.2 - index * 0.1, 2.1 - index * 0.1, 2.0 - index * 0.1],
    };
  });
}

export function normalizeWarRoomData(
  value: unknown,
  source: WarRoomData["source"],
  sourceLabel: string,
): WarRoomData {
  const fallback = mockWarRoomData;
  const input = toObject(value);

  const oldAds = toObject(input.ads);
  const oldFinance = toObject(input.finance);
  const oldCopy = toObject(input.copy);
  const oldProduction = toObject(oldCopy.productionFlow);
  const oldTech = toObject(input.tech);

  const globalInput = toObject(input.globalOverview);
  const squadsInput = toObject(input.squads);
  const financeInput = toObject(input.finance);
  const creativeFactoryInput = toObject(input.creativeFactory);
  const squadSyncInput = toObject(input.squadSync);
  const contingencyInput = toObject(input.contingency);
  const enterpriseInput = toObject(input.enterprise);

  const fbInput = toObject(squadsInput.facebook);
  const gInput = toObject(squadsInput.googleYoutube);
  const ttInput = toObject(squadsInput.tiktok);

  const liveInput = Array.isArray(input.liveAdsTracking)
    ? input.liveAdsTracking
    : deriveLegacyLiveRows(input).length > 0
      ? deriveLegacyLiveRows(input)
      : fallback.liveAdsTracking;

  const liveAdsTracking = (liveInput as unknown[]).map((item, index) => {
    const row = toObject(item);
    const fallbackRow = fallback.liveAdsTracking[index % fallback.liveAdsTracking.length];
    return {
      id: toString(row.id, fallbackRow.id),
      squad: toSquad(row.squad, fallbackRow.squad),
      campaign: toString(row.campaign, fallbackRow.campaign),
      adName: toString(row.adName, fallbackRow.adName),
      impressions: toNumber(row.impressions, fallbackRow.impressions),
      clicks: toNumber(row.clicks, fallbackRow.clicks),
      views3s: toNumber(row.views3s, fallbackRow.views3s),
      views15s: toNumber(row.views15s, fallbackRow.views15s),
      ic: toNumber(row.ic, fallbackRow.ic),
      lp: toNumber(row.lp, fallbackRow.lp),
      roas: toNumber(row.roas, fallbackRow.roas),
      frequency: toNumber(row.frequency, fallbackRow.frequency),
      uniqueCtr: toNumber(row.uniqueCtr, fallbackRow.uniqueCtr),
      aov: toNumber(row.aov, fallbackRow.aov),
      upsellConversion: toNumber(row.upsellConversion, fallbackRow.upsellConversion),
      ltv: toNumber(row.ltv, fallbackRow.ltv),
      cpa: toNumber(row.cpa, fallbackRow.cpa),
      trend24h: {
        hookRate: toNumberArray(toObject(row.trend24h).hookRate, fallbackRow.trend24h.hookRate),
        holdRate: toNumberArray(toObject(row.trend24h).holdRate, fallbackRow.trend24h.holdRate),
        roas: toNumberArray(toObject(row.trend24h).roas, fallbackRow.trend24h.roas),
      },
      frequencyTrend3d: toNumberArray(row.frequencyTrend3d, fallbackRow.frequencyTrend3d),
      uniqueCtrTrend3d: toNumberArray(row.uniqueCtrTrend3d, fallbackRow.uniqueCtrTrend3d),
    };
  });

  const tasksInput = Array.isArray(creativeFactoryInput.tasks)
    ? creativeFactoryInput.tasks
    : [
        ...toStringArray(oldProduction.roteirizando, []).map((title) => ({
          title,
          status: "Roteiro",
          squad: "facebook",
          owner: "Copy Squad",
          metricContext: "Migrado de schema legado",
          updatedAt: "Agora",
        })),
        ...toStringArray(oldProduction.gravando, []).map((title) => ({
          title,
          status: "Gravacao",
          squad: "facebook",
          owner: "Creator Squad",
          metricContext: "Migrado de schema legado",
          updatedAt: "Agora",
        })),
        ...toStringArray(oldProduction.editando, []).map((title) => ({
          title,
          status: "Edicao",
          squad: "googleYoutube",
          owner: "Editor Squad",
          metricContext: "Migrado de schema legado",
          updatedAt: "Agora",
        })),
      ];

  const tasks = (tasksInput as unknown[]).map((item, index) => {
    const row = toObject(item);
    const fallbackTask = fallback.creativeFactory.tasks[index % fallback.creativeFactory.tasks.length];
    return {
      id: toString(row.id, fallbackTask.id),
      squad: toSquad(row.squad, fallbackTask.squad),
      title: toString(row.title, fallbackTask.title),
      owner: toString(row.owner, fallbackTask.owner),
      status: toStage(row.status, fallbackTask.status),
      metricContext: toString(row.metricContext, fallbackTask.metricContext),
      updatedAt: toString(row.updatedAt, fallbackTask.updatedAt),
    };
  });

  const briefingInput = Array.isArray(input.dailyBriefing) ? input.dailyBriefing : fallback.dailyBriefing;
  const dailyBriefing = (briefingInput as unknown[]).map((item, index) => {
    const row = toObject(item);
    const fallbackBriefing = fallback.dailyBriefing[index % fallback.dailyBriefing.length];
    const repliesInput = Array.isArray(row.replies) ? row.replies : fallbackBriefing.replies;

    return {
      id: toString(row.id, fallbackBriefing.id),
      squad: toSquad(row.squad, fallbackBriefing.squad),
      trafficManagerComment: toString(row.trafficManagerComment, fallbackBriefing.trafficManagerComment),
      replies: (repliesInput as unknown[]).map((reply, replyIndex) => {
        const replyRow = toObject(reply);
        const fallbackReply = fallbackBriefing.replies[replyIndex % fallbackBriefing.replies.length];
        return {
          role: toReplyRole(replyRow.role, fallbackReply.role),
          author: toString(replyRow.author, fallbackReply.author),
          version: toString(replyRow.version, fallbackReply.version),
          assetUrl: toString(replyRow.assetUrl, fallbackReply.assetUrl),
          note: toString(replyRow.note, fallbackReply.note),
        };
      }),
    };
  });

  const activityInput = Array.isArray(input.activityLog) ? input.activityLog : fallback.activityLog;
  const activityLog = (activityInput as unknown[]).map((item, index) => {
    const row = toObject(item);
    const fallbackLog = fallback.activityLog[index % fallback.activityLog.length];
    return {
      id: toString(row.id, fallbackLog.id),
      actorRole: toString(row.actorRole, fallbackLog.actorRole),
      actorName: toString(row.actorName, fallbackLog.actorName),
      action: toString(row.action, fallbackLog.action),
      entity: toString(row.entity, fallbackLog.entity),
      reason: toString(row.reason, fallbackLog.reason),
      timestamp: toString(row.timestamp, fallbackLog.timestamp),
    };
  });

  const derivedNetRevenue = toNumber(oldFinance.netRevenue, toNumber(oldFinance.revenue, fallback.finance.netRevenue) * 0.62);
  const derivedProfitMargin =
    toNumber(oldFinance.profitMargin, 0) ||
    (toNumber(oldFinance.revenue, 0) > 0
      ? (derivedNetRevenue / toNumber(oldFinance.revenue, fallback.globalOverview.revenue)) * 100
      : fallback.finance.profitMargin);

  const trafficSourcesInput = Array.isArray(globalInput.trafficSources)
    ? globalInput.trafficSources
    : fallback.globalOverview.trafficSources;
  const trafficSources = (trafficSourcesInput as unknown[]).map((item, index) => {
    const row = toObject(item);
    const fallbackSource = fallback.globalOverview.trafficSources[index % fallback.globalOverview.trafficSources.length];
    return {
      source: toString(row.source, fallbackSource.source),
      spend: toNumber(row.spend, fallbackSource.spend),
    };
  });

  const domainsInput = Array.isArray(contingencyInput.domains) ? contingencyInput.domains : fallback.contingency.domains;
  const adAccountsInput = Array.isArray(contingencyInput.adAccounts)
    ? contingencyInput.adAccounts
    : fallback.contingency.adAccounts;
  const enterpriseCeoInput = toObject(enterpriseInput.ceoFinance);
  const enterpriseCopyInput = toObject(enterpriseInput.copyResearch);
  const enterpriseTrafficInput = toObject(enterpriseInput.trafficAttribution);
  const enterpriseEditorsInput = toObject(enterpriseInput.editorsProduction);
  const enterpriseTechInput = toObject(enterpriseInput.techCro);
  const enterpriseTrafficSquadsInput = toObject(enterpriseTrafficInput.squads);

  const normalized: WarRoomData = {
    source,
    sourceLabel,
    updatedAt: toString(input.updatedAt, new Date().toISOString()),
    globalOverview: {
      investment: toNumber(globalInput.investment, toNumber(oldAds.investmentTotal, fallback.globalOverview.investment)),
      revenue: toNumber(globalInput.revenue, toNumber(oldFinance.revenue, fallback.globalOverview.revenue)),
      utmifySyncAt: toString(globalInput.utmifySyncAt, fallback.globalOverview.utmifySyncAt),
      trafficSources: trafficSources.length > 0 ? trafficSources : fallback.globalOverview.trafficSources,
    },
    squads: {
      facebook: {
        name: toString(fbInput.name, fallback.squads.facebook.name),
        focus: toString(fbInput.focus, fallback.squads.facebook.focus),
        creativeVelocity: toNumber(fbInput.creativeVelocity, fallback.squads.facebook.creativeVelocity),
        creativeVelocityTarget: toNumber(
          fbInput.creativeVelocityTarget,
          fallback.squads.facebook.creativeVelocityTarget,
        ),
        validatedCreatives: toNumber(fbInput.validatedCreatives, fallback.squads.facebook.validatedCreatives),
        managerComment: toString(fbInput.managerComment, fallback.squads.facebook.managerComment),
      },
      googleYoutube: {
        name: toString(gInput.name, fallback.squads.googleYoutube.name),
        focus: toString(gInput.focus, fallback.squads.googleYoutube.focus),
        creativeVelocity: toNumber(gInput.creativeVelocity, fallback.squads.googleYoutube.creativeVelocity),
        creativeVelocityTarget: toNumber(
          gInput.creativeVelocityTarget,
          fallback.squads.googleYoutube.creativeVelocityTarget,
        ),
        validatedCreatives: toNumber(gInput.validatedCreatives, fallback.squads.googleYoutube.validatedCreatives),
        managerComment: toString(gInput.managerComment, fallback.squads.googleYoutube.managerComment),
      },
      tiktok: {
        name: toString(ttInput.name, fallback.squads.tiktok.name),
        focus: toString(ttInput.focus, fallback.squads.tiktok.focus),
        creativeVelocity: toNumber(ttInput.creativeVelocity, fallback.squads.tiktok.creativeVelocity),
        creativeVelocityTarget: toNumber(ttInput.creativeVelocityTarget, fallback.squads.tiktok.creativeVelocityTarget),
        validatedCreatives: toNumber(ttInput.validatedCreatives, fallback.squads.tiktok.validatedCreatives),
        managerComment: toString(ttInput.managerComment, fallback.squads.tiktok.managerComment),
      },
    },
    liveAdsTracking: liveAdsTracking.length > 0 ? liveAdsTracking : fallback.liveAdsTracking,
    creativeFactory: {
      tasks: tasks.length > 0 ? tasks : fallback.creativeFactory.tasks,
    },
    dailyBriefing: dailyBriefing.length > 0 ? dailyBriefing : fallback.dailyBriefing,
    finance: {
      netRevenue: toNumber(financeInput.netRevenue, derivedNetRevenue),
      profitMargin: toNumber(financeInput.profitMargin, derivedProfitMargin),
      contributionMargin: toNumber(financeInput.contributionMargin, fallback.finance.contributionMargin),
      approvalRate: toNumber(financeInput.approvalRate, fallback.finance.approvalRate),
      approvalCard: toNumber(financeInput.approvalCard, fallback.finance.approvalCard),
      approvalPix: toNumber(financeInput.approvalPix, fallback.finance.approvalPix),
      ltv24h: toNumber(financeInput.ltv24h, fallback.finance.ltv24h),
      upsellTakeRate: toNumber(financeInput.upsellTakeRate, fallback.finance.upsellTakeRate),
      ltv: toNumber(financeInput.ltv, fallback.finance.ltv),
    },
    squadSync: {
      lastReportAt: toString(squadSyncInput.lastReportAt, fallback.squadSync.lastReportAt),
      dailyInput: {
        creativeId: toString(toObject(squadSyncInput.dailyInput).creativeId, fallback.squadSync.dailyInput.creativeId),
        kpisToday: {
          hookRate: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisToday).hookRate,
            fallback.squadSync.dailyInput.kpisToday.hookRate,
          ),
          holdRate15s: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisToday).holdRate15s,
            fallback.squadSync.dailyInput.kpisToday.holdRate15s,
          ),
          ctrOutbound: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisToday).ctrOutbound,
            fallback.squadSync.dailyInput.kpisToday.ctrOutbound,
          ),
          icRate: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisToday).icRate,
            fallback.squadSync.dailyInput.kpisToday.icRate,
          ),
          frequency: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisToday).frequency,
            fallback.squadSync.dailyInput.kpisToday.frequency,
          ),
        },
        kpisYesterday: {
          hookRate: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisYesterday).hookRate,
            fallback.squadSync.dailyInput.kpisYesterday.hookRate,
          ),
          holdRate15s: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisYesterday).holdRate15s,
            fallback.squadSync.dailyInput.kpisYesterday.holdRate15s,
          ),
          ctrOutbound: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisYesterday).ctrOutbound,
            fallback.squadSync.dailyInput.kpisYesterday.ctrOutbound,
          ),
          icRate: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisYesterday).icRate,
            fallback.squadSync.dailyInput.kpisYesterday.icRate,
          ),
          frequency: toNumber(
            toObject(toObject(squadSyncInput.dailyInput).kpisYesterday).frequency,
            fallback.squadSync.dailyInput.kpisYesterday.frequency,
          ),
        },
        sentimentNotes: toString(
          toObject(squadSyncInput.dailyInput).sentimentNotes,
          fallback.squadSync.dailyInput.sentimentNotes,
        ),
      },
      commandOrders: (Array.isArray(squadSyncInput.commandOrders)
        ? squadSyncInput.commandOrders
        : fallback.squadSync.commandOrders
      ).map((item, index) => {
        const row = toObject(item);
        const fallbackOrder = fallback.squadSync.commandOrders[index % fallback.squadSync.commandOrders.length];
        const audience = row.audience;
        const status = row.status;
        return {
          id: toString(row.id, fallbackOrder.id),
          audience:
            audience === "editors" ||
            audience === "copywriters" ||
            audience === "mediaBuyers" ||
            audience === "techCro" ||
            audience === "ceoFinance"
              ? audience
              : fallbackOrder.audience,
          status: status === "winner" || status === "scaling" || status === "failing" ? status : fallbackOrder.status,
          title: toString(row.title, fallbackOrder.title),
          diagnosis: toString(row.diagnosis, fallbackOrder.diagnosis),
          action: toString(row.action, fallbackOrder.action),
          createdAt: toString(row.createdAt, fallbackOrder.createdAt),
        };
      }),
      notifications: {
        lastDispatchAt: toString(
          toObject(squadSyncInput.notifications).lastDispatchAt,
          fallback.squadSync.notifications.lastDispatchAt,
        ),
        lastMessage: toString(toObject(squadSyncInput.notifications).lastMessage, fallback.squadSync.notifications.lastMessage),
        slackStatus: (() => {
          const value = toObject(squadSyncInput.notifications).slackStatus;
          return value === "idle" || value === "sent" || value === "simulated" || value === "failed"
            ? value
            : fallback.squadSync.notifications.slackStatus;
        })(),
        whatsappStatus: (() => {
          const value = toObject(squadSyncInput.notifications).whatsappStatus;
          return value === "idle" || value === "sent" || value === "simulated" || value === "failed"
            ? value
            : fallback.squadSync.notifications.whatsappStatus;
        })(),
      },
    },
    contingency: {
      domains: (domainsInput as unknown[]).map((item, index) => {
        const row = toObject(item);
        const fallbackDomain = fallback.contingency.domains[index % fallback.contingency.domains.length];
        return {
          name: toString(row.name, fallbackDomain.name),
          status: toStatus(row.status, fallbackDomain.status),
          score: toNumber(row.score, fallbackDomain.score),
          lastCheck: toString(row.lastCheck, fallbackDomain.lastCheck),
        };
      }),
      adAccounts: (adAccountsInput as unknown[]).map((item, index) => {
        const row = toObject(item);
        const fallbackAccount = fallback.contingency.adAccounts[index % fallback.contingency.adAccounts.length];
        return {
          name: toString(row.name, fallbackAccount.name),
          status: toStatus(row.status, fallbackAccount.status),
          score: toNumber(row.score, fallbackAccount.score),
          lastCheck: toString(row.lastCheck, fallbackAccount.lastCheck),
        };
      }),
      fanpages: (Array.isArray(contingencyInput.fanpages) ? contingencyInput.fanpages : fallback.contingency.fanpages).map(
        (item, index) => {
          const row = toObject(item);
          const fallbackPage = fallback.contingency.fanpages[index % fallback.contingency.fanpages.length];
          return {
            name: toString(row.name, fallbackPage.name),
            status: toStatus(row.status, fallbackPage.status),
            score: toNumber(row.score, fallbackPage.score),
            lastCheck: toString(row.lastCheck, fallbackPage.lastCheck),
          };
        },
      ),
    },
    enterprise: {
      ceoFinance: {
        grossRevenue: toNumber(enterpriseCeoInput.grossRevenue, fallback.enterprise.ceoFinance.grossRevenue),
        adSpend: toNumber(enterpriseCeoInput.adSpend, fallback.enterprise.ceoFinance.adSpend),
        gatewayFees: toNumber(enterpriseCeoInput.gatewayFees, fallback.enterprise.ceoFinance.gatewayFees),
        nfseTaxes: toNumber(enterpriseCeoInput.nfseTaxes, fallback.enterprise.ceoFinance.nfseTaxes),
        netProfit: toNumber(enterpriseCeoInput.netProfit, fallback.enterprise.ceoFinance.netProfit),
        mer: toNumber(enterpriseCeoInput.mer, fallback.enterprise.ceoFinance.mer),
        ltvCohorts: {
          d30: toNumber(toObject(enterpriseCeoInput.ltvCohorts).d30, fallback.enterprise.ceoFinance.ltvCohorts.d30),
          d60: toNumber(toObject(enterpriseCeoInput.ltvCohorts).d60, fallback.enterprise.ceoFinance.ltvCohorts.d60),
          d90: toNumber(toObject(enterpriseCeoInput.ltvCohorts).d90, fallback.enterprise.ceoFinance.ltvCohorts.d90),
        },
        paybackDays: toNumber(enterpriseCeoInput.paybackDays, fallback.enterprise.ceoFinance.paybackDays),
        taxProvision: toNumber(enterpriseCeoInput.taxProvision, fallback.enterprise.ceoFinance.taxProvision),
        recoveryLeaderboard: (Array.isArray(enterpriseCeoInput.recoveryLeaderboard)
          ? enterpriseCeoInput.recoveryLeaderboard
          : fallback.enterprise.ceoFinance.recoveryLeaderboard
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackAgent =
            fallback.enterprise.ceoFinance.recoveryLeaderboard[
              index % fallback.enterprise.ceoFinance.recoveryLeaderboard.length
            ];
          return {
            agent: toString(row.agent, fallbackAgent.agent),
            boletoRecoveryRate: toNumber(row.boletoRecoveryRate, fallbackAgent.boletoRecoveryRate),
            pixRecoveryRate: toNumber(row.pixRecoveryRate, fallbackAgent.pixRecoveryRate),
            recoveredRevenue: toNumber(row.recoveredRevenue, fallbackAgent.recoveredRevenue),
          };
        }),
      },
      copyResearch: {
        uniqueMechanismProblem: toString(
          enterpriseCopyInput.uniqueMechanismProblem,
          fallback.enterprise.copyResearch.uniqueMechanismProblem,
        ),
        uniqueMechanismSolution: toString(
          enterpriseCopyInput.uniqueMechanismSolution,
          fallback.enterprise.copyResearch.uniqueMechanismSolution,
        ),
        bigIdeaVault: (Array.isArray(enterpriseCopyInput.bigIdeaVault)
          ? enterpriseCopyInput.bigIdeaVault
          : fallback.enterprise.copyResearch.bigIdeaVault
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackIdea = fallback.enterprise.copyResearch.bigIdeaVault[index % fallback.enterprise.copyResearch.bigIdeaVault.length];
          return {
            id: toString(row.id, fallbackIdea.id),
            title: toString(row.title, fallbackIdea.title),
            saturation: toNumber(row.saturation, fallbackIdea.saturation),
            expiresAt: toString(row.expiresAt, fallbackIdea.expiresAt),
          };
        }),
        avatarDossier: (Array.isArray(enterpriseCopyInput.avatarDossier)
          ? enterpriseCopyInput.avatarDossier
          : fallback.enterprise.copyResearch.avatarDossier
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackAvatar =
            fallback.enterprise.copyResearch.avatarDossier[index % fallback.enterprise.copyResearch.avatarDossier.length];
          return {
            pain: toString(row.pain, fallbackAvatar.pain),
            desire: toString(row.desire, fallbackAvatar.desire),
            objection: toString(row.objection, fallbackAvatar.objection),
            supportInsight: toString(row.supportInsight, fallbackAvatar.supportInsight),
          };
        }),
        scriptEditor: toString(enterpriseCopyInput.scriptEditor, fallback.enterprise.copyResearch.scriptEditor),
      },
      trafficAttribution: {
        squads: {
          meta: {
            targetCpa: toNumber(
              toObject(enterpriseTrafficSquadsInput.meta).targetCpa,
              fallback.enterprise.trafficAttribution.squads.meta.targetCpa,
            ),
            currentCpa: toNumber(
              toObject(enterpriseTrafficSquadsInput.meta).currentCpa,
              fallback.enterprise.trafficAttribution.squads.meta.currentCpa,
            ),
            roas: toNumber(toObject(enterpriseTrafficSquadsInput.meta).roas, fallback.enterprise.trafficAttribution.squads.meta.roas),
            stability48h: toNumber(
              toObject(enterpriseTrafficSquadsInput.meta).stability48h,
              fallback.enterprise.trafficAttribution.squads.meta.stability48h,
            ),
          },
          google: {
            targetCpa: toNumber(
              toObject(enterpriseTrafficSquadsInput.google).targetCpa,
              fallback.enterprise.trafficAttribution.squads.google.targetCpa,
            ),
            currentCpa: toNumber(
              toObject(enterpriseTrafficSquadsInput.google).currentCpa,
              fallback.enterprise.trafficAttribution.squads.google.currentCpa,
            ),
            roas: toNumber(
              toObject(enterpriseTrafficSquadsInput.google).roas,
              fallback.enterprise.trafficAttribution.squads.google.roas,
            ),
            stability48h: toNumber(
              toObject(enterpriseTrafficSquadsInput.google).stability48h,
              fallback.enterprise.trafficAttribution.squads.google.stability48h,
            ),
          },
          native: {
            targetCpa: toNumber(
              toObject(enterpriseTrafficSquadsInput.native).targetCpa,
              fallback.enterprise.trafficAttribution.squads.native.targetCpa,
            ),
            currentCpa: toNumber(
              toObject(enterpriseTrafficSquadsInput.native).currentCpa,
              fallback.enterprise.trafficAttribution.squads.native.currentCpa,
            ),
            roas: toNumber(
              toObject(enterpriseTrafficSquadsInput.native).roas,
              fallback.enterprise.trafficAttribution.squads.native.roas,
            ),
            stability48h: toNumber(
              toObject(enterpriseTrafficSquadsInput.native).stability48h,
              fallback.enterprise.trafficAttribution.squads.native.stability48h,
            ),
          },
        },
        deepAttribution: (Array.isArray(enterpriseTrafficInput.deepAttribution)
          ? enterpriseTrafficInput.deepAttribution
          : fallback.enterprise.trafficAttribution.deepAttribution
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackItem =
            fallback.enterprise.trafficAttribution.deepAttribution[
              index % fallback.enterprise.trafficAttribution.deepAttribution.length
            ];
          return {
            creativeId: toString(row.creativeId, fallbackItem.creativeId),
            source: toTrafficSource(row.source, fallbackItem.source),
            netProfit: toNumber(row.netProfit, fallbackItem.netProfit),
            ltv: toNumber(row.ltv, fallbackItem.ltv),
          };
        }),
        scaleCalculator: {
          suggestedIncreasePct: toNumber(
            toObject(enterpriseTrafficInput.scaleCalculator).suggestedIncreasePct,
            fallback.enterprise.trafficAttribution.scaleCalculator.suggestedIncreasePct,
          ),
          reason: toString(
            toObject(enterpriseTrafficInput.scaleCalculator).reason,
            fallback.enterprise.trafficAttribution.scaleCalculator.reason,
          ),
        },
      },
      editorsProduction: {
        hookLibrary: (Array.isArray(enterpriseEditorsInput.hookLibrary)
          ? enterpriseEditorsInput.hookLibrary
          : fallback.enterprise.editorsProduction.hookLibrary
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackHook =
            fallback.enterprise.editorsProduction.hookLibrary[index % fallback.enterprise.editorsProduction.hookLibrary.length];
          return {
            hook: toString(row.hook, fallbackHook.hook),
            creativeId: toString(row.creativeId, fallbackHook.creativeId),
            hookRate: toNumber(row.hookRate, fallbackHook.hookRate),
          };
        }),
        retentionHeatmap: (Array.isArray(enterpriseEditorsInput.retentionHeatmap)
          ? enterpriseEditorsInput.retentionHeatmap
          : fallback.enterprise.editorsProduction.retentionHeatmap
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackHeat =
            fallback.enterprise.editorsProduction.retentionHeatmap[
              index % fallback.enterprise.editorsProduction.retentionHeatmap.length
            ];
          return {
            second: toNumber(row.second, fallbackHeat.second),
            dropOff: toNumber(row.dropOff, fallbackHeat.dropOff),
          };
        }),
        patternInterruptChecklist: {
          every3s:
            typeof toObject(enterpriseEditorsInput.patternInterruptChecklist).every3s === "boolean"
              ? Boolean(toObject(enterpriseEditorsInput.patternInterruptChecklist).every3s)
              : fallback.enterprise.editorsProduction.patternInterruptChecklist.every3s,
          soundDesign:
            typeof toObject(enterpriseEditorsInput.patternInterruptChecklist).soundDesign === "boolean"
              ? Boolean(toObject(enterpriseEditorsInput.patternInterruptChecklist).soundDesign)
              : fallback.enterprise.editorsProduction.patternInterruptChecklist.soundDesign,
          vfx:
            typeof toObject(enterpriseEditorsInput.patternInterruptChecklist).vfx === "boolean"
              ? Boolean(toObject(enterpriseEditorsInput.patternInterruptChecklist).vfx)
              : fallback.enterprise.editorsProduction.patternInterruptChecklist.vfx,
        },
      },
      techCro: {
        lcpSeconds: toNumber(enterpriseTechInput.lcpSeconds, fallback.enterprise.techCro.lcpSeconds),
        abTests: (Array.isArray(enterpriseTechInput.abTests) ? enterpriseTechInput.abTests : fallback.enterprise.techCro.abTests).map(
          (item, index) => {
            const row = toObject(item);
            const fallbackTest = fallback.enterprise.techCro.abTests[index % fallback.enterprise.techCro.abTests.length];
            return {
              test: toString(row.test, fallbackTest.test),
              variantA: toNumber(row.variantA, fallbackTest.variantA),
              variantB: toNumber(row.variantB, fallbackTest.variantB),
              winner: toString(row.winner, fallbackTest.winner),
            };
          },
        ),
        checkout: {
          cartAbandonment: toNumber(
            toObject(enterpriseTechInput.checkout).cartAbandonment,
            fallback.enterprise.techCro.checkout.cartAbandonment,
          ),
          checkoutConversion: toNumber(
            toObject(enterpriseTechInput.checkout).checkoutConversion,
            fallback.enterprise.techCro.checkout.checkoutConversion,
          ),
          gatewayAlert:
            typeof toObject(enterpriseTechInput.checkout).gatewayAlert === "boolean"
              ? Boolean(toObject(enterpriseTechInput.checkout).gatewayAlert)
              : fallback.enterprise.techCro.checkout.gatewayAlert,
        },
        upsellFlow: (Array.isArray(enterpriseTechInput.upsellFlow)
          ? enterpriseTechInput.upsellFlow
          : fallback.enterprise.techCro.upsellFlow
        ).map((item, index) => {
          const row = toObject(item);
          const fallbackFlow = fallback.enterprise.techCro.upsellFlow[index % fallback.enterprise.techCro.upsellFlow.length];
          return {
            step: toString(row.step, fallbackFlow.step),
            clickRate: toNumber(row.clickRate, fallbackFlow.clickRate),
          };
        }),
      },
    },
    activityLog: activityLog.length > 0 ? activityLog : fallback.activityLog,
    oldSchema: {
      ads: {
        investmentTotal: toNumber(oldAds.investmentTotal, 0),
        avgRoas: toNumber(oldAds.avgRoas, 0),
        avgCpm: toNumber(oldAds.avgCpm, 0),
      },
      copy: {
        angles: toStringArray(oldCopy.angles, []),
        hooksBacklog: toStringArray(oldCopy.hooksBacklog, []),
        productionFlow: {
          roteirizando: toStringArray(oldProduction.roteirizando, []),
          gravando: toStringArray(oldProduction.gravando, []),
          editando: toStringArray(oldProduction.editando, []),
        },
      },
      tech: {
        pageLoadDropOff: toNumber(oldTech.pageLoadDropOff, 0),
        pageLoadNote: toString(oldTech.pageLoadNote, ""),
        vslRetention: toNumber(oldTech.vslRetention, 0),
        vslNote: toString(oldTech.vslNote, ""),
        checkoutConversion: toNumber(oldTech.checkoutConversion, 0),
        checkoutNote: toString(oldTech.checkoutNote, ""),
      },
      finance: {
        revenue: toNumber(oldFinance.revenue, 0),
        netRevenue: toNumber(oldFinance.netRevenue, 0),
        profitMargin: toNumber(oldFinance.profitMargin, 0),
        approvalRate: toNumber(oldFinance.approvalRate, 0),
        ltv: toNumber(oldFinance.ltv, 0),
      },
    },
  };

  return normalized;
}
