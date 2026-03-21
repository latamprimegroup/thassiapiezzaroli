import { randomUUID } from "node:crypto";
import type { UserRole } from "@/lib/auth/rbac";
import { getDemoUserById } from "@/lib/auth/users";
import { toDateOnlyIso } from "@/lib/metrics/daily-settlement";
import { getDailySettlementByUserDate, upsertDailySettlement } from "@/lib/persistence/daily-settlement-repository";
import {
  appendSniperAttributionEvent,
  appendSniperAuditLog,
  appendSniperMessage,
  cancelPendingQueueForChat,
  enqueueSniperQueueItems,
  getSniperChatById,
  getSniperDashboardSnapshot,
  listSniperAttributionEvents,
  listSniperFunnels,
  listSniperInstances,
  listSniperMessages,
  listSniperQueueDue,
  listSniperChats,
  markSniperChatContacted,
  setSniperChatAutomationState,
  updateSniperChatStage,
  updateSniperQueueStatus,
  upsertSniperChat,
  upsertSniperFunnel,
  upsertSniperInstance,
} from "@/lib/persistence/sniper-crm-repository";
import {
  applyQuickCommand,
  buildQueueItemsFromFunnel,
  defaultSniperStorePayload,
  randomIntBetween,
  resolveTypingCps,
} from "@/lib/sniper-crm/engine";
import type {
  SniperAuditEventType,
  SniperChat,
  SniperFunnelTemplate,
  SniperKanbanStage,
  SniperMessageKind,
  SniperQueueItem,
} from "@/lib/sniper-crm/types";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";

export const SNIPER_ALLOWED_ROLES: UserRole[] = ["ceo", "closer", "sdr", "cxManager", "headTraffic", "trafficSenior"];

function isRoleAllowed(role: UserRole) {
  return SNIPER_ALLOWED_ROLES.includes(role);
}

function roleCanSpy(role: UserRole) {
  return role === "ceo";
}

function roleCanChangeSettings(role: UserRole) {
  return role === "ceo" || role === "headTraffic";
}

function roleCanMoveStage(role: UserRole) {
  return role === "ceo" || role === "closer" || role === "sdr" || role === "cxManager";
}

function nowIso() {
  return new Date().toISOString();
}

async function notifyTrafficAttribution(message: string) {
  const [slackUrl, whatsappUrl] = [process.env.SLACK_WEBHOOK_URL, process.env.WHATSAPP_WEBHOOK_URL];
  const payloads = [
    slackUrl
      ? fetch(slackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message }) }).catch(
          () => null,
        )
      : Promise.resolve(null),
    whatsappUrl
      ? fetch(whatsappUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }).catch(() => null)
      : Promise.resolve(null),
  ];
  await Promise.all(payloads);
}

async function bootstrapForUser(session: { userId: string; role: UserRole }) {
  if (!isRoleAllowed(session.role)) {
    return;
  }
  const includeAll = roleCanSpy(session.role);
  const ownerUserId = includeAll ? undefined : session.userId;
  const existingInstances = await listSniperInstances({ ownerUserId, includeAll });
  if (existingInstances.length === 0) {
    const user = getDemoUserById(session.userId);
    await upsertSniperInstance({
      label: `WhatsApp ${user?.name ?? session.userId}`,
      ownerUserId: session.userId,
      ownerUserName: user?.name ?? session.userId,
      status: "qr_pending",
      qrCodeText: `QR-${session.userId}-${Date.now()}`,
      connectedAt: "",
      conversionGoalDaily: 8,
      conversionsToday: 0,
    });
  }
  const existingChats = await listSniperChats({ ownerUserId, includeAll, limit: 1 });
  if (existingChats.length > 0) {
    return;
  }

  const data = await getWarRoomData();
  const leads = data.customerCentrality?.leads ?? [];
  if (leads.length === 0) {
    return;
  }
  const user = getDemoUserById(session.userId);
  const instance = (await listSniperInstances({ ownerUserId, includeAll }))[0];
  for (const lead of leads.slice(0, 16)) {
    const chat = await upsertSniperChat({
      instanceId: instance?.id ?? `inst-${session.userId}`,
      ownerUserId: session.userId,
      ownerUserName: user?.name ?? session.userId,
      assignedCloserUserId: session.userId,
      assignedCloserUserName: user?.name ?? session.userId,
      profile: {
        leadId: lead.leadId,
        leadName: `Lead ${lead.leadId.slice(-4)}`,
        phone: `+55 11 9${String(randomIntBetween(1000_0000, 9999_9999))}`,
        niche: "geral",
        managerUserId: "u-traf-sr",
        managerUserName: "Caio (Trafego Senior)",
        utmSource: "meta",
        utmCampaign: `crm-${lead.awarenessStage}`,
        utmContent: lead.lastVslId || "CR-001",
        originAdName: `AD_${(lead.lastVslId || "CR-001").replaceAll("-", "_")}`,
        creativeId: lead.lastVslId || "CR-001",
        offerId: "OFF-001",
        cartValue: Math.round(Math.max(97, lead.predictedLtv90d * 0.35)),
        abandonmentStep: lead.watchCompletionPct > 80 ? "pagamento" : lead.watchCompletionPct > 60 ? "telefone" : "email",
        checkoutDroppedAt: new Date(Date.now() - randomIntBetween(2, 58) * 60_000).toISOString(),
        vslId: lead.lastVslId || "VSL-001",
        vslWatchSeconds: lead.watchSeconds,
        vslCompletionPct: lead.watchCompletionPct,
        predictedLtv90d: lead.predictedLtv90d,
      },
      stage: lead.purchases > 0 ? "vendido" : lead.watchCompletionPct > 75 ? "contato" : "lead",
      priority: lead.watchCompletionPct > 80 ? "urgent" : lead.watchCompletionPct > 55 ? "high" : "normal",
      tags: ["seed", lead.awarenessStage],
      awaitingResponse: lead.purchases === 0,
      contacted: false,
      firstContactAt: "",
      automationPaused: false,
      automationPausedAt: "",
      automationPausedReason: "",
      latestMessagePreview: "Lead importado do Offers Lab",
      latestMessageAt: lead.lastTouchAt,
      lastInboundAt: lead.lastTouchAt,
      lastOutboundAt: "",
      nextFollowUpAt: "",
    });
    await appendSniperMessage({
      chatId: chat.id,
      instanceId: chat.instanceId,
      direction: "system",
      kind: "text",
      stateSignal: "",
      text: `Lead importado do Offers Lab (${lead.awarenessStage})`,
      mediaUrl: "",
      voiceDurationSec: 0,
      sentByUserId: "system",
      sentByUserName: "Sniper CRM",
      sentByRole: "system",
      meta: {
        quickCommand: "",
        funnelRunId: "",
        queueId: "",
        typingCps: 0,
        randomDelaySec: 0,
      },
    });
  }
}

async function appendAudit(params: {
  chatId: string;
  actorUserId: string;
  actorUserName: string;
  actorRole: UserRole | "system";
  eventType: SniperAuditEventType;
  note: string;
}) {
  await appendSniperAuditLog({
    chatId: params.chatId,
    actorUserId: params.actorUserId,
    actorUserName: params.actorUserName,
    actorRole: params.actorRole,
    eventType: params.eventType,
    note: params.note,
  });
}

export async function processFirstContactWebhook(params: {
  chatId: string;
  actorUserId: string;
  actorUserName: string;
  actorRole: UserRole | "system";
}) {
  const marked = await markSniperChatContacted({
    chatId: params.chatId,
  });
  if (!marked) {
    return null;
  }
  await appendAudit({
    chatId: params.chatId,
    actorUserId: params.actorUserId,
    actorUserName: params.actorUserName,
    actorRole: params.actorRole,
    eventType: "first_contact_webhook",
    note: "Webhook interno confirmou primeiro contato e atualizou status para 'Ja contatado'.",
  });
  return marked;
}

export async function getSniperDashboard(params: {
  session: { userId: string; role: UserRole };
  search?: string;
  awaitingResponseOnly?: boolean;
  chatId?: string;
}) {
  if (!isRoleAllowed(params.session.role)) {
    throw new Error("Sem permissao para Sniper CRM.");
  }
  await bootstrapForUser(params.session);
  const includeAll = roleCanSpy(params.session.role);
  const ownerUserId = includeAll ? undefined : params.session.userId;
  const snapshot = await getSniperDashboardSnapshot({
    ownerUserId,
    includeAll,
    search: params.search,
    awaitingResponseOnly: params.awaitingResponseOnly,
  });
  const selectedChat = params.chatId
    ? snapshot.smartInbox.find((chat) => chat.id === params.chatId) ?? snapshot.smartInbox[0]
    : snapshot.smartInbox[0];
  const messages = selectedChat ? await listSniperMessages(selectedChat.id, 250) : [];
  const funnels = await listSniperFunnels({ ownerUserId, includeAll });
  const attribution = await listSniperAttributionEvents({ managerUserId: includeAll ? undefined : params.session.userId, limit: 50 });
  const attributionByCreative = attribution.reduce<Record<string, { creativeId: string; sales: number; grossRevenue: number }>>(
    (acc, row) => {
      const current = acc[row.creativeId] ?? { creativeId: row.creativeId, sales: 0, grossRevenue: 0 };
      current.sales += 1;
      current.grossRevenue += row.grossRevenue;
      acc[row.creativeId] = current;
      return acc;
    },
    {},
  );

  return {
    ...snapshot,
    selectedChat: selectedChat ?? null,
    selectedMessages: messages,
    funnels: funnels.length > 0 ? funnels : defaultSniperStorePayload().funnels,
    attributionByCreative: Object.values(attributionByCreative).sort((a, b) => b.grossRevenue - a.grossRevenue),
    spyModeEnabled: includeAll,
  };
}

export async function createOrUpdateFunnel(params: {
  session: { userId: string; role: UserRole };
  funnel: Omit<SniperFunnelTemplate, "id" | "ownerUserId" | "ownerUserName" | "createdAt" | "updatedAt"> & { id?: string };
}) {
  if (!roleCanChangeSettings(params.session.role)) {
    throw new Error("Sem permissao para configurar funis.");
  }
  const user = getDemoUserById(params.session.userId);
  return upsertSniperFunnel({
    ...params.funnel,
    ownerUserId: params.session.userId,
    ownerUserName: user?.name ?? params.session.userId,
  });
}

export async function saveInstance(params: {
  session: { userId: string; role: UserRole };
  instance: {
    id?: string;
    label: string;
    status: "offline" | "qr_pending" | "connected" | "syncing" | "error";
    conversionGoalDaily: number;
    conversionsToday: number;
    qrCodeText?: string;
  };
}) {
  if (!isRoleAllowed(params.session.role)) {
    throw new Error("Sem permissao para instancias.");
  }
  const user = getDemoUserById(params.session.userId);
  return upsertSniperInstance({
    id: params.instance.id,
    label: params.instance.label,
    ownerUserId: params.session.userId,
    ownerUserName: user?.name ?? params.session.userId,
    status: params.instance.status,
    qrCodeText: params.instance.qrCodeText || `QR-${params.session.userId}-${Date.now()}`,
    connectedAt: params.instance.status === "connected" ? nowIso() : "",
    conversionGoalDaily: params.instance.conversionGoalDaily,
    conversionsToday: params.instance.conversionsToday,
  });
}

export async function sendChatMessage(params: {
  session: { userId: string; role: UserRole };
  chatId: string;
  text?: string;
  mediaUrl?: string;
  quickCommand?: string;
  direction: "inbound" | "outbound";
  kind?: SniperMessageKind;
}) {
  if (!isRoleAllowed(params.session.role)) {
    throw new Error("Sem permissao para mensagens.");
  }
  const chat = await getSniperChatById(params.chatId);
  if (!chat) {
    throw new Error("Chat nao encontrado.");
  }
  const includeAll = roleCanSpy(params.session.role);
  if (!includeAll && chat.ownerUserId !== params.session.userId) {
    throw new Error("Nao autorizado para este chat.");
  }
  const user = getDemoUserById(params.session.userId);
  const applied = params.quickCommand ? applyQuickCommand(params.quickCommand) : null;
  const text = applied ? applied.text : params.text || "";
  const kind = applied ? applied.kind : params.kind || "text";
  const mediaUrl = applied ? applied.mediaUrl : params.mediaUrl || "";
  const previousMessages = await listSniperMessages(chat.id, 400);
  const firstOutbound = params.direction === "outbound" && !previousMessages.some((item) => item.direction === "outbound");
  if (firstOutbound) {
    const typingCps = resolveTypingCps(text || "oi");
    const randomDelaySec = randomIntBetween(3, 7);
    await appendSniperMessage({
      chatId: chat.id,
      instanceId: chat.instanceId,
      direction: "system",
      kind: "state",
      stateSignal: kind === "audio" ? "recording" : "composing",
      text: kind === "audio" ? "Gravando..." : "Digitando...",
      mediaUrl: "",
      voiceDurationSec: 0,
      sentByUserId: "system",
      sentByUserName: "Sniper Bot",
      sentByRole: "system",
      meta: {
        quickCommand: "",
        funnelRunId: "",
        queueId: "",
        typingCps,
        randomDelaySec,
      },
    });
  }
  const message = await appendSniperMessage({
    chatId: chat.id,
    instanceId: chat.instanceId,
    direction: params.direction,
    kind,
    stateSignal: "",
    text,
    mediaUrl,
    voiceDurationSec: kind === "audio" ? Math.max(6, Math.round(text.length / 12)) : 0,
    sentByUserId: params.session.userId,
    sentByUserName: user?.name ?? params.session.userId,
    sentByRole: params.session.role,
    meta: {
      quickCommand: params.quickCommand ?? "",
      funnelRunId: "",
      queueId: "",
      typingCps: 0,
      randomDelaySec: 0,
    },
  });

  if (params.direction === "inbound") {
    await setSniperChatAutomationState({
      chatId: chat.id,
      paused: true,
      reason: "lead_respondeu_no_funil",
    });
    await cancelPendingQueueForChat(chat.id, "automation_paused_by_inbound");
    await appendAudit({
      chatId: chat.id,
      actorUserId: params.session.userId,
      actorUserName: user?.name ?? params.session.userId,
      actorRole: params.session.role,
      eventType: "automation_paused",
      note: "Lead respondeu. Sequencia automatica pausada.",
    });
  }
  if (firstOutbound) {
    await processFirstContactWebhook({
      chatId: chat.id,
      actorUserId: "system",
      actorUserName: "Sniper CRM Webhook",
      actorRole: "system",
    });
  }

  return message;
}

export async function launchFunnelForChat(params: {
  session: { userId: string; role: UserRole };
  chatId: string;
  funnelId: string;
}) {
  if (!isRoleAllowed(params.session.role)) {
    throw new Error("Sem permissao para funis.");
  }
  const chat = await getSniperChatById(params.chatId);
  if (!chat) {
    throw new Error("Chat nao encontrado.");
  }
  const includeAll = roleCanSpy(params.session.role);
  if (!includeAll && chat.ownerUserId !== params.session.userId) {
    throw new Error("Nao autorizado para este chat.");
  }
  if (chat.automationPaused) {
    throw new Error("Automacao pausada. Retome o chat antes de disparar funil.");
  }
  const funnels = await listSniperFunnels({ ownerUserId: includeAll ? undefined : params.session.userId, includeAll });
  const funnel = funnels.find((row) => row.id === params.funnelId);
  if (!funnel) {
    throw new Error("Funil nao encontrado.");
  }
  const { items, funnelRunId } = buildQueueItemsFromFunnel({
    chat,
    funnel,
    ownerUserId: chat.ownerUserId,
  });
  await enqueueSniperQueueItems(items);
  const user = getDemoUserById(params.session.userId);
  await appendAudit({
    chatId: chat.id,
    actorUserId: params.session.userId,
    actorUserName: user?.name ?? params.session.userId,
    actorRole: params.session.role,
    eventType: "funnel_launched",
    note: `Funil ${funnel.title} disparado (${items.length} passos).`,
  });
  return {
    chatId: chat.id,
    funnelRunId,
    queued: items.length,
    nextRunAt: items[0]?.scheduledFor ?? "",
  };
}

export async function dispatchSniperQueue(params: {
  session: { userId: string; role: UserRole };
  limit?: number;
}) {
  if (!isRoleAllowed(params.session.role)) {
    throw new Error("Sem permissao para fila.");
  }
  const includeAll = roleCanSpy(params.session.role);
  const dueItems = await listSniperQueueDue({
    ownerUserId: includeAll ? undefined : params.session.userId,
    includeAll,
    limit: params.limit ?? 30,
  });
  let dispatched = 0;
  let paused = 0;
  for (const item of dueItems) {
    const chat = await getSniperChatById(item.chatId);
    if (!chat) {
      await updateSniperQueueStatus({
        ids: [item.id],
        status: "failed",
        errorMessage: "chat_not_found",
      });
      continue;
    }
    if (chat.automationPaused) {
      paused += 1;
      await updateSniperQueueStatus({
        ids: [item.id],
        status: "cancelled",
        errorMessage: "automation_paused",
      });
      continue;
    }
    await appendSniperMessage({
      chatId: chat.id,
      instanceId: chat.instanceId,
      direction: "system",
      kind: "state",
      stateSignal: item.stateSignalBeforeSend,
      text: item.stateSignalBeforeSend === "recording" ? "Gravando audio..." : "Digitando...",
      mediaUrl: "",
      voiceDurationSec: 0,
      sentByUserId: "system",
      sentByUserName: "Sniper Bot",
      sentByRole: "system",
      meta: {
        quickCommand: "",
        funnelRunId: item.funnelRunId,
        queueId: item.id,
        typingCps: item.typingCps,
        randomDelaySec: item.randomDelaySec,
      },
    });
    await appendSniperMessage({
      chatId: chat.id,
      instanceId: chat.instanceId,
      direction: "outbound",
      kind: item.kind,
      stateSignal: "",
      text: item.text,
      mediaUrl: item.mediaUrl,
      voiceDurationSec: item.kind === "audio" ? Math.max(6, Math.round(item.text.length / 12)) : 0,
      sentByUserId: chat.assignedCloserUserId || params.session.userId,
      sentByUserName: chat.assignedCloserUserName || params.session.userId,
      sentByRole: "closer",
      meta: {
        quickCommand: "",
        funnelRunId: item.funnelRunId,
        queueId: item.id,
        typingCps: item.typingCps,
        randomDelaySec: item.randomDelaySec,
      },
    });
    await updateSniperQueueStatus({
      ids: [item.id],
      status: "dispatched",
    });
    await appendAudit({
      chatId: chat.id,
      actorUserId: "system",
      actorUserName: "Sniper Bot",
      actorRole: "system",
      eventType: "message_sent",
      note: `Mensagem automatica enviada (${item.stepLabel}).`,
    });
    dispatched += 1;
  }
  return {
    due: dueItems.length,
    dispatched,
    paused,
  };
}

async function registerSaleInDailySettlement(params: {
  managerUserId: string;
  managerUserName: string;
  managerRole: UserRole;
  niche: string;
  creativeId: string;
  grossRevenue: number;
  chatId: string;
  leadId: string;
}) {
  const date = toDateOnlyIso(new Date());
  const existing = await getDailySettlementByUserDate(params.managerUserId, date);
  const audienceInsightBase = existing?.audienceInsight || "";
  const productionFeedbackBase = existing?.productionFeedback || "";
  const audienceInsight = `${audienceInsightBase}\n[Sniper CRM] Venda WhatsApp confirmada no chat ${params.chatId} (lead ${params.leadId}).`.trim();
  const productionFeedback = `${productionFeedbackBase}\n[Sniper CRM] Criativo ${params.creativeId} converteu venda via closer. Replicar variação.`.trim();
  return upsertDailySettlement({
    userId: params.managerUserId,
    userName: params.managerUserName,
    userRole: params.managerRole,
    date,
    niche: params.niche || existing?.niche || "geral",
    adSpend: existing?.adSpend ?? 0,
    salesCount: (existing?.salesCount ?? 0) + 1,
    grossRevenue: (existing?.grossRevenue ?? 0) + params.grossRevenue,
    ctr: existing?.ctr ?? 0,
    cpc: existing?.cpc ?? 0,
    cpm: existing?.cpm ?? 0,
    checkoutRate: existing?.checkoutRate ?? 0,
    winningCreativeId: params.creativeId || existing?.winningCreativeId || "CRM-WHATSAPP",
    audienceInsight: audienceInsight || "Feedback automatico do Sniper CRM.",
    productionFeedback: productionFeedback || "Feedback automatico do Sniper CRM.",
  });
}

export async function moveChatStage(params: {
  session: { userId: string; role: UserRole };
  chatId: string;
  stage: SniperKanbanStage;
  priority?: SniperChat["priority"];
  grossRevenue?: number;
}) {
  if (!roleCanMoveStage(params.session.role)) {
    throw new Error("Sem permissao para mover lead no Kanban.");
  }
  const chat = await getSniperChatById(params.chatId);
  if (!chat) {
    throw new Error("Chat nao encontrado.");
  }
  const includeAll = roleCanSpy(params.session.role);
  if (!includeAll && chat.ownerUserId !== params.session.userId) {
    throw new Error("Nao autorizado para mover este lead.");
  }
  const updated = await updateSniperChatStage({
    chatId: params.chatId,
    stage: params.stage,
    priority: params.priority,
  });
  if (!updated) {
    throw new Error("Falha ao atualizar stage.");
  }
  const user = getDemoUserById(params.session.userId);
  await appendAudit({
    chatId: updated.id,
    actorUserId: params.session.userId,
    actorUserName: user?.name ?? params.session.userId,
    actorRole: params.session.role,
    eventType: "stage_changed",
    note: `Kanban movido para ${params.stage}.`,
  });

  if (params.stage === "vendido") {
    const grossRevenue = Math.max(0, Number(params.grossRevenue ?? 0));
    const managerUserId = updated.profile.managerUserId || updated.ownerUserId;
    const managerUser = getDemoUserById(managerUserId);
    const managerRole = (managerUser?.role ?? "trafficSenior") as UserRole;
    const managerName = managerUser?.name ?? updated.profile.managerUserName ?? managerUserId;
    if (grossRevenue > 0) {
      await registerSaleInDailySettlement({
        managerUserId,
        managerUserName: managerName,
        managerRole,
        niche: updated.profile.niche,
        creativeId: updated.profile.creativeId || updated.profile.utmContent || updated.profile.leadId,
        grossRevenue,
        chatId: updated.id,
        leadId: updated.profile.leadId,
      });
    }
    await appendSniperAttributionEvent({
      chatId: updated.id,
      leadId: updated.profile.leadId,
      managerUserId,
      managerUserName: managerName,
      creativeId: updated.profile.creativeId || updated.profile.utmContent || "CRM-UNKNOWN",
      utmSource: updated.profile.utmSource,
      utmCampaign: updated.profile.utmCampaign,
      utmContent: updated.profile.utmContent,
      offerId: updated.profile.offerId,
      grossRevenue,
      occurredAt: nowIso(),
    });
    await appendAudit({
      chatId: updated.id,
      actorUserId: params.session.userId,
      actorUserName: user?.name ?? params.session.userId,
      actorRole: params.session.role,
      eventType: "sale_registered",
      note: `Venda registrada no CRM (receita ${grossRevenue.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      })}).`,
    });
    await notifyTrafficAttribution(
      [
        "SNIPER CRM - ATRIBUICAO REVERSA",
        `Lead: ${updated.profile.leadId}`,
        `Criativo: ${updated.profile.creativeId || updated.profile.utmContent}`,
        `UTM: ${updated.profile.utmSource}/${updated.profile.utmCampaign}/${updated.profile.utmContent}`,
        `Receita: ${grossRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`,
        `Gestor trafego: ${managerName}`,
      ].join(" | "),
    );
  }
  return updated;
}

export async function scheduleFollowUp(params: {
  session: { userId: string; role: UserRole };
  chatId: string;
  text: string;
  followUpAt: string;
}) {
  if (!isRoleAllowed(params.session.role)) {
    throw new Error("Sem permissao para agendamento.");
  }
  const chat = await getSniperChatById(params.chatId);
  if (!chat) {
    throw new Error("Chat nao encontrado.");
  }
  const includeAll = roleCanSpy(params.session.role);
  if (!includeAll && chat.ownerUserId !== params.session.userId) {
    throw new Error("Nao autorizado para este chat.");
  }
  const followUpAt = new Date(params.followUpAt);
  if (Number.isNaN(followUpAt.getTime())) {
    throw new Error("Data/hora de follow-up invalida.");
  }
  const queueItem: SniperQueueItem = {
    id: `q-${randomUUID()}`,
    chatId: chat.id,
    instanceId: chat.instanceId,
    ownerUserId: chat.ownerUserId,
    funnelRunId: "",
    status: "pending",
    scheduledFor: followUpAt.toISOString(),
    randomDelaySec: randomIntBetween(3, 7),
    typingCps: 5.1,
    stepLabel: "follow-up-infinito",
    kind: "text",
    text: params.text,
    mediaUrl: "",
    stateSignalBeforeSend: "composing",
    dispatchedAt: "",
    errorMessage: "",
    createdAt: nowIso(),
  };
  await enqueueSniperQueueItems([queueItem]);
  await setSniperChatAutomationState({
    chatId: chat.id,
    paused: false,
    followUpAt: followUpAt.toISOString(),
  });
  const user = getDemoUserById(params.session.userId);
  await appendAudit({
    chatId: chat.id,
    actorUserId: params.session.userId,
    actorUserName: user?.name ?? params.session.userId,
    actorRole: params.session.role,
    eventType: "message_queued",
    note: `Follow-up agendado para ${followUpAt.toISOString()}.`,
  });
  return queueItem;
}

