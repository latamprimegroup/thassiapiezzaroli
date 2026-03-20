import { mockWarRoomData } from "./mock-data";
import type { DailyReplyRole, PipelineStage, SquadKey, WarRoomData } from "./types";

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

function toSquad(value: unknown, fallback: SquadKey): SquadKey {
  return value === "facebook" || value === "googleYoutube" ? value : fallback;
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

    return {
      id: toString(row.id, `LEG-${index + 1}`),
      squad: index % 2 === 0 ? "facebook" : "googleYoutube",
      campaign: index % 2 === 0 ? "Legacy Facebook" : "Legacy Google/YouTube",
      adName: `Criativo legado ${index + 1}`,
      impressions,
      views3s,
      views15s,
      ic,
      lp,
      roas: toNumber(row.roas, 1.5),
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

  const globalInput = toObject(input.globalOverview);
  const squadsInput = toObject(input.squads);
  const financeInput = toObject(input.finance);
  const creativeFactoryInput = toObject(input.creativeFactory);

  const fbInput = toObject(squadsInput.facebook);
  const gInput = toObject(squadsInput.googleYoutube);

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
      views3s: toNumber(row.views3s, fallbackRow.views3s),
      views15s: toNumber(row.views15s, fallbackRow.views15s),
      ic: toNumber(row.ic, fallbackRow.ic),
      lp: toNumber(row.lp, fallbackRow.lp),
      roas: toNumber(row.roas, fallbackRow.roas),
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

  const normalized: WarRoomData = {
    source,
    sourceLabel,
    updatedAt: toString(input.updatedAt, new Date().toISOString()),
    globalOverview: {
      investment: toNumber(globalInput.investment, toNumber(oldAds.investmentTotal, fallback.globalOverview.investment)),
      revenue: toNumber(globalInput.revenue, toNumber(oldFinance.revenue, fallback.globalOverview.revenue)),
      utmifySyncAt: toString(globalInput.utmifySyncAt, fallback.globalOverview.utmifySyncAt),
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
    },
    liveAdsTracking: liveAdsTracking.length > 0 ? liveAdsTracking : fallback.liveAdsTracking,
    creativeFactory: {
      tasks: tasks.length > 0 ? tasks : fallback.creativeFactory.tasks,
    },
    dailyBriefing: dailyBriefing.length > 0 ? dailyBriefing : fallback.dailyBriefing,
    finance: {
      approvalRate: toNumber(financeInput.approvalRate, fallback.finance.approvalRate),
      ltv: toNumber(financeInput.ltv, fallback.finance.ltv),
    },
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
      finance: {
        revenue: toNumber(oldFinance.revenue, 0),
        approvalRate: toNumber(oldFinance.approvalRate, 0),
        ltv: toNumber(oldFinance.ltv, 0),
      },
    },
  };

  return normalized;
}
