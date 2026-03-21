import type { UserRole } from "@/lib/auth/rbac";

export type SniperInstanceStatus = "offline" | "qr_pending" | "connected" | "syncing" | "error";
export type SniperPriorityTag = "normal" | "high" | "urgent";
export type SniperKanbanStage = "lead" | "contato" | "boleto_pix_gerado" | "vendido";
export type SniperMessageDirection = "inbound" | "outbound" | "system";
export type SniperMessageKind = "text" | "audio" | "video" | "image" | "state";
export type SniperStateSignal = "composing" | "recording";
export type SniperQueueStatus = "pending" | "dispatched" | "cancelled" | "failed";
export type SniperAuditEventType =
  | "message_queued"
  | "message_sent"
  | "automation_paused"
  | "automation_resumed"
  | "stage_changed"
  | "sale_registered"
  | "funnel_launched";

export type SniperCrmInstance = {
  id: string;
  label: string;
  ownerUserId: string;
  ownerUserName: string;
  status: SniperInstanceStatus;
  qrCodeText: string;
  connectedAt: string;
  conversionGoalDaily: number;
  conversionsToday: number;
  createdAt: string;
  updatedAt: string;
};

export type SniperLeadProfile = {
  leadId: string;
  leadName: string;
  phone: string;
  niche: string;
  managerUserId: string;
  managerUserName: string;
  utmSource: string;
  utmCampaign: string;
  utmContent: string;
  creativeId: string;
  offerId: string;
  vslId: string;
  vslWatchSeconds: number;
  vslCompletionPct: number;
  predictedLtv90d: number;
};

export type SniperChat = {
  id: string;
  instanceId: string;
  ownerUserId: string;
  ownerUserName: string;
  assignedCloserUserId: string;
  assignedCloserUserName: string;
  profile: SniperLeadProfile;
  stage: SniperKanbanStage;
  priority: SniperPriorityTag;
  tags: string[];
  awaitingResponse: boolean;
  automationPaused: boolean;
  automationPausedAt: string;
  automationPausedReason: string;
  latestMessagePreview: string;
  latestMessageAt: string;
  lastInboundAt: string;
  lastOutboundAt: string;
  nextFollowUpAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SniperMessage = {
  id: string;
  chatId: string;
  instanceId: string;
  direction: SniperMessageDirection;
  kind: SniperMessageKind;
  stateSignal: SniperStateSignal | "";
  text: string;
  mediaUrl: string;
  voiceDurationSec: number;
  sentByUserId: string;
  sentByUserName: string;
  sentByRole: UserRole | "system";
  createdAt: string;
  meta: {
    quickCommand: string;
    funnelRunId: string;
    queueId: string;
    typingCps: number;
    randomDelaySec: number;
  };
};

export type SniperFunnelStep = {
  id: string;
  label: string;
  waitSeconds: number;
  kind: "text" | "audio" | "image" | "video";
  text: string;
  mediaUrl: string;
};

export type SniperFunnelTemplate = {
  id: string;
  ownerUserId: string;
  ownerUserName: string;
  title: string;
  active: boolean;
  steps: SniperFunnelStep[];
  createdAt: string;
  updatedAt: string;
};

export type SniperQueueItem = {
  id: string;
  chatId: string;
  instanceId: string;
  ownerUserId: string;
  funnelRunId: string;
  status: SniperQueueStatus;
  scheduledFor: string;
  randomDelaySec: number;
  typingCps: number;
  stepLabel: string;
  kind: "text" | "audio" | "image" | "video";
  text: string;
  mediaUrl: string;
  stateSignalBeforeSend: SniperStateSignal;
  dispatchedAt: string;
  errorMessage: string;
  createdAt: string;
};

export type SniperAuditLog = {
  id: string;
  chatId: string;
  actorUserId: string;
  actorUserName: string;
  actorRole: UserRole | "system";
  eventType: SniperAuditEventType;
  note: string;
  createdAt: string;
};

export type SniperAttributionEvent = {
  id: string;
  chatId: string;
  leadId: string;
  managerUserId: string;
  managerUserName: string;
  creativeId: string;
  utmSource: string;
  utmCampaign: string;
  utmContent: string;
  offerId: string;
  grossRevenue: number;
  occurredAt: string;
};

export type SniperStorePayload = {
  instances: SniperCrmInstance[];
  chats: SniperChat[];
  messages: SniperMessage[];
  funnels: SniperFunnelTemplate[];
  queue: SniperQueueItem[];
  auditLogs: SniperAuditLog[];
  attributionEvents: SniperAttributionEvent[];
};

