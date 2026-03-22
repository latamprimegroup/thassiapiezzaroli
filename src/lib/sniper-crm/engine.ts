import { randomUUID } from "node:crypto";
import type {
  SniperChat,
  SniperFunnelTemplate,
  SniperQueueItem,
  SniperStateSignal,
  SniperStorePayload,
} from "@/lib/sniper-crm/types";

const MIN_RANDOM_DELAY_SECONDS = 3;
const MAX_RANDOM_DELAY_SECONDS = 7;

export function randomIntBetween(min: number, max: number) {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  const value = Math.floor(Math.random() * (high - low + 1)) + low;
  return Number.isFinite(value) ? value : low;
}

export function resolveTypingCps(text: string) {
  const textLength = text.trim().length;
  const base = textLength <= 80 ? 6.8 : textLength <= 180 ? 5.3 : 4.4;
  const jitter = randomIntBetween(-10, 12) / 100;
  return Math.max(3.5, Number((base * (1 + jitter)).toFixed(2)));
}

export function resolveStateSignal(kind: "text" | "audio" | "image" | "video"): SniperStateSignal {
  if (kind === "audio") {
    return "recording";
  }
  return "composing";
}

export function buildQueueItemsFromFunnel(params: {
  chat: SniperChat;
  funnel: SniperFunnelTemplate;
  ownerUserId: string;
  launchedAt?: Date;
}) {
  const launchedAt = params.launchedAt ?? new Date();
  const funnelRunId = `funnel-${randomUUID()}`;
  let cursor = launchedAt.getTime();
  const items: SniperQueueItem[] = [];

  for (const step of params.funnel.steps) {
    const randomDelaySec = randomIntBetween(MIN_RANDOM_DELAY_SECONDS, MAX_RANDOM_DELAY_SECONDS);
    cursor += Math.max(0, step.waitSeconds) * 1000 + randomDelaySec * 1000;
    const typingCps = resolveTypingCps(step.text || step.label);
    items.push({
      id: randomUUID(),
      chatId: params.chat.id,
      instanceId: params.chat.instanceId,
      ownerUserId: params.ownerUserId,
      funnelRunId,
      status: "pending",
      scheduledFor: new Date(cursor).toISOString(),
      randomDelaySec,
      typingCps,
      stepLabel: step.label,
      kind: step.kind,
      text: step.text,
      mediaUrl: step.mediaUrl,
      stateSignalBeforeSend: resolveStateSignal(step.kind),
      dispatchedAt: "",
      errorMessage: "",
      createdAt: launchedAt.toISOString(),
    });
  }
  return { funnelRunId, items };
}

export function defaultSniperStorePayload(): SniperStorePayload {
  const now = new Date().toISOString();
  return {
    instances: [],
    chats: [],
    messages: [],
    funnels: [
      {
        id: "funnel-default-one-click",
        ownerUserId: "u-closer",
        ownerUserName: "Closer Padrão",
        title: "One-Click: Texto > Audio Expert > Prova Social",
        active: true,
        steps: [
          {
            id: "step-1",
            label: "Texto de abertura",
            waitSeconds: 0,
            kind: "text",
            text: "Perfeito. Vi que você chegou até o checkout agora pouco. Posso te ajudar a concluir sem risco?",
            mediaUrl: "",
          },
          {
            id: "step-2",
            label: "Audio do Expert",
            waitSeconds: 300,
            kind: "audio",
            text: "Áudio curto do expert com quebra de objeção.",
            mediaUrl: "",
          },
          {
            id: "step-3",
            label: "Prova social",
            waitSeconds: 3600,
            kind: "image",
            text: "Te envio uma prova real de aluno para você validar a decisão.",
            mediaUrl: "",
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    queue: [],
    auditLogs: [],
    attributionEvents: [],
  };
}

export function estimateResponseSlaMinutes(chat: SniperChat, now = new Date()) {
  if (!chat.awaitingResponse) {
    return 0;
  }
  const base = chat.lastInboundAt || chat.latestMessageAt || chat.updatedAt || chat.createdAt;
  const startedAt = new Date(base);
  if (Number.isNaN(startedAt.getTime())) {
    return 0;
  }
  const diff = now.getTime() - startedAt.getTime();
  return Math.max(0, Math.round(diff / 60000));
}

export function applyQuickCommand(commandRaw: string) {
  const command = commandRaw.trim().toLowerCase();
  if (command.startsWith("/pix")) {
    return {
      text: "Aqui está seu link PIX seguro para concluir agora: https://pay.example/pix",
      mediaUrl: "",
      kind: "text" as const,
    };
  }
  if (command.startsWith("/prova")) {
    return {
      text: "Te enviei uma prova social com resultado real para validar a decisão.",
      mediaUrl: "https://cdn.example.com/provas/prova-social.jpg",
      kind: "image" as const,
    };
  }
  if (command.startsWith("/audio")) {
    return {
      text: "Enviando áudio com resposta direta à sua objeção agora.",
      mediaUrl: "https://cdn.example.com/audio/expert.ogg",
      kind: "audio" as const,
    };
  }
  return {
    text: commandRaw.trim(),
    mediaUrl: "",
    kind: "text" as const,
  };
}

