"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SniperCrmPayload = {
  instances: Array<{
    id: string;
    label: string;
    status: "offline" | "qr_pending" | "connected" | "syncing" | "error";
    qrCodeText: string;
    conversionGoalDaily: number;
    conversionsToday: number;
    ownerUserId: string;
    ownerUserName: string;
  }>;
  counters: {
    totalChats: number;
    awaitingResponse: number;
    pausedAutomation: number;
    dueQueueItems: number;
  };
  smartInbox: Array<{
    id: string;
    stage: "lead" | "contato" | "boleto_pix_gerado" | "vendido";
    priority: "normal" | "high" | "urgent";
    awaitingResponse: boolean;
    automationPaused: boolean;
    automationPausedReason: string;
    latestMessagePreview: string;
    latestMessageAt: string;
    assignedCloserUserName: string;
    profile: {
      leadId: string;
      leadName: string;
      phone: string;
      utmSource: string;
      utmCampaign: string;
      utmContent: string;
      creativeId: string;
      offerId: string;
      vslWatchSeconds: number;
      vslCompletionPct: number;
      predictedLtv90d: number;
      managerUserName: string;
      niche: string;
    };
    slaMinutes: number;
  }>;
  selectedChat: (SniperCrmPayload["smartInbox"][number] & {
    ownerUserId: string;
    ownerUserName: string;
  }) | null;
  selectedMessages: Array<{
    id: string;
    direction: "inbound" | "outbound" | "system";
    kind: "text" | "audio" | "video" | "image" | "state";
    stateSignal: "" | "composing" | "recording";
    text: string;
    mediaUrl: string;
    sentByUserName: string;
    createdAt: string;
    meta: {
      quickCommand: string;
      funnelRunId: string;
      queueId: string;
      typingCps: number;
      randomDelaySec: number;
    };
  }>;
  stageBoard: Record<"lead" | "contato" | "boleto_pix_gerado" | "vendido", SniperCrmPayload["smartInbox"]>;
  funnels: Array<{
    id: string;
    title: string;
    active: boolean;
    steps: Array<{
      id: string;
      label: string;
      waitSeconds: number;
      kind: "text" | "audio" | "image" | "video";
      text: string;
      mediaUrl: string;
    }>;
  }>;
  attributionByCreative: Array<{
    creativeId: string;
    sales: number;
    grossRevenue: number;
  }>;
  spyModeEnabled: boolean;
};

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const stageLabel: Record<"lead" | "contato" | "boleto_pix_gerado" | "vendido", string> = {
  lead: "Lead",
  contato: "Contato",
  boleto_pix_gerado: "Boleto/PIX",
  vendido: "Vendido",
};

const stageTone: Record<"lead" | "contato" | "boleto_pix_gerado" | "vendido", string> = {
  lead: "border-slate-500/40 bg-slate-500/10",
  contato: "border-sky-500/40 bg-sky-500/10",
  boleto_pix_gerado: "border-[#FF9900]/40 bg-[#FF9900]/10",
  vendido: "border-[#10B981]/40 bg-[#10B981]/10",
};

function toneForPriority(priority: "normal" | "high" | "urgent") {
  if (priority === "urgent") {
    return "danger";
  }
  if (priority === "high") {
    return "warning";
  }
  return "default";
}

function buildCopilotSuggestion(chat: SniperCrmPayload["selectedChat"]) {
  if (!chat) {
    return "Selecione um lead para receber sugestão de quebra de objeção.";
  }
  if (chat.automationPaused) {
    return "Lead respondeu no meio do funil. Priorize resposta humana curta e objetiva antes de retomar automação.";
  }
  if (chat.stage === "boleto_pix_gerado") {
    return "Use urgência ética: confirme comprovante, reduza fricção e reforce garantia para acelerar fechamento.";
  }
  if (chat.profile.vslCompletionPct >= 80) {
    return "Lead altamente aquecido. Use prova social + CTA direto para PIX com follow-up em 15 minutos.";
  }
  if (chat.profile.vslCompletionPct < 45) {
    return "Objeção provável de clareza. Envie áudio curto com mecanismo único e benefício principal em 30 segundos.";
  }
  return "Sugestão: faça pergunta diagnóstica de objeção e em seguida envie comando /prova para reduzir risco percebido.";
}

export function SniperCrmModule() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<SniperCrmPayload | null>(null);
  const [activeChatId, setActiveChatId] = useState("");
  const [search, setSearch] = useState("");
  const [awaitingOnly, setAwaitingOnly] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [quickCommand, setQuickCommand] = useState("");
  const [followUpText, setFollowUpText] = useState("Voltei para te ajudar no fechamento. Quer que eu te mande o link PIX novamente?");
  const [followUpAt, setFollowUpAt] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [soldRevenue, setSoldRevenue] = useState(0);
  const [dragChatId, setDragChatId] = useState("");

  const fetchDashboard = useCallback(async () => {
    setError("");
    const query = new URLSearchParams();
    if (search.trim()) {
      query.set("search", search.trim());
    }
    if (awaitingOnly) {
      query.set("filter", "awaiting_response");
    }
    if (activeChatId) {
      query.set("chatId", activeChatId);
    }
    const response = await fetch(`/api/sniper-crm/dashboard?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setLoading(false);
      setError("Falha ao carregar o Sniper CRM.");
      return;
    }
    const data = (await response.json().catch(() => null)) as SniperCrmPayload | null;
    if (!data) {
      setLoading(false);
      setError("Resposta inválida do Sniper CRM.");
      return;
    }
    setPayload(data);
    setLoading(false);
    if (!activeChatId && data.selectedChat?.id) {
      setActiveChatId(data.selectedChat.id);
    }
    if (!selectedFunnelId && data.funnels[0]?.id) {
      setSelectedFunnelId(data.funnels[0].id);
    }
  }, [activeChatId, awaitingOnly, search, selectedFunnelId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchDashboard();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  const selectedChat = payload?.selectedChat ?? null;
  const copilotSuggestion = useMemo(() => buildCopilotSuggestion(selectedChat), [selectedChat]);

  async function postJson(url: string, body: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      const data = (await response?.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Falha na operação.");
    }
    return response.json().catch(() => null);
  }

  async function sendOutboundMessage() {
    if (!selectedChat || (!chatDraft.trim() && !quickCommand.trim())) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/messages", {
        chatId: selectedChat.id,
        direction: "outbound",
        text: chatDraft.trim(),
        quickCommand: quickCommand.trim() || undefined,
      });
      setChatDraft("");
      setQuickCommand("");
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao enviar mensagem.");
    }
  }

  async function sendQuickAsset(command: "/pix" | "/prova" | "/audio") {
    if (!selectedChat) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/messages", {
        chatId: selectedChat.id,
        direction: "outbound",
        quickCommand: command,
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao enviar quick asset.");
    }
  }

  async function simulateInbound() {
    if (!selectedChat) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/messages", {
        chatId: selectedChat.id,
        direction: "inbound",
        text: "Tenho uma dúvida rápida sobre pagamento. Pode me ajudar?",
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao simular inbound.");
    }
  }

  async function launchFunnel() {
    if (!selectedChat || !selectedFunnelId) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/funnels/launch", {
        chatId: selectedChat.id,
        funnelId: selectedFunnelId,
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao disparar funil.");
    }
  }

  async function dispatchQueueNow() {
    try {
      await postJson("/api/sniper-crm/queue/dispatch", {
        limit: 40,
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao processar fila.");
    }
  }

  async function scheduleFollowUp() {
    if (!selectedChat || !followUpText.trim() || !followUpAt) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/follow-up", {
        chatId: selectedChat.id,
        text: followUpText.trim(),
        followUpAt,
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao agendar follow-up.");
    }
  }

  async function setAutomationPaused(paused: boolean) {
    if (!selectedChat) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/automation", {
        chatId: selectedChat.id,
        paused,
        reason: paused ? "Pausa manual pelo closer" : "Retomada manual",
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao alterar automação.");
    }
  }

  async function connectFirstInstance() {
    const current = payload?.instances[0];
    if (!current) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/instances", {
        id: current.id,
        label: current.label,
        status: "connected",
        conversionGoalDaily: current.conversionGoalDaily,
        conversionsToday: current.conversionsToday,
        qrCodeText: current.qrCodeText,
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao conectar instância.");
    }
  }

  async function moveStage(chatId: string, stage: "lead" | "contato" | "boleto_pix_gerado" | "vendido") {
    try {
      await postJson("/api/sniper-crm/stage", {
        chatId,
        stage,
        grossRevenue: stage === "vendido" ? soldRevenue : undefined,
      });
      await fetchDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao mover lead no Kanban.");
    }
  }

  function renderMessage(message: SniperCrmPayload["selectedMessages"][number]) {
    const isInbound = message.direction === "inbound";
    const align = isInbound ? "items-start" : "items-end";
    const bubbleTone = isInbound
      ? "border-white/15 bg-black/40 text-slate-100"
      : "border-[#10B981]/30 bg-[#10B981]/10 text-[#D7FFE9]";
    if (message.kind === "state") {
      return (
        <div key={message.id} className="text-[11px] text-slate-400">
          [{message.createdAt.slice(11, 16)}] Estado: {message.stateSignal} ({message.meta.typingCps.toFixed(1)} cps)
        </div>
      );
    }
    return (
      <div key={message.id} className={`flex ${align}`}>
        <div className={`max-w-[85%] rounded border px-2 py-1 text-xs ${bubbleTone}`}>
          <p className="text-[11px] text-slate-400">
            {message.sentByUserName} • {message.createdAt.slice(11, 16)}
          </p>
          {message.text ? <p>{message.text}</p> : null}
          {message.mediaUrl ? <p className="mt-1 truncate text-[11px] text-[#FFD39A]">{message.mediaUrl}</p> : null}
          {message.meta.quickCommand ? <p className="mt-1 text-[10px] text-slate-400">cmd: {message.meta.quickCommand}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-white/10 bg-[#050505]">
        <CardHeader>
          <CardTitle className="text-base">Sniper CRM Nativo - Command Cockpit (4 Colunas)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs md:grid-cols-4">
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <p className="text-slate-400">Total de chats</p>
            <p className="text-lg text-slate-100">{payload?.counters.totalChats ?? 0}</p>
          </div>
          <div className="rounded border border-[#FF9900]/30 bg-[#FF9900]/10 p-2">
            <p className="text-slate-300">Aguardando resposta (SLA)</p>
            <p className="text-lg text-[#FFD39A]">{payload?.counters.awaitingResponse ?? 0}</p>
          </div>
          <div className="rounded border border-rose-300/30 bg-rose-500/10 p-2">
            <p className="text-slate-300">Automação pausada</p>
            <p className="text-lg text-rose-200">{payload?.counters.pausedAutomation ?? 0}</p>
          </div>
          <div className="rounded border border-[#10B981]/30 bg-[#10B981]/10 p-2">
            <p className="text-slate-300">Fila pendente (due)</p>
            <p className="text-lg text-[#D7FFE9]">{payload?.counters.dueQueueItems ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[0.95fr_1fr_1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1) Instâncias, Status e Metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(payload?.instances ?? []).map((instance) => (
              <div key={instance.id} className="rounded border border-white/10 bg-white/5 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-slate-100">{instance.label}</p>
                  <Badge variant={instance.status === "connected" ? "success" : instance.status === "error" ? "danger" : "warning"}>
                    {instance.status}
                  </Badge>
                </div>
                <p className="text-slate-400">Owner: {instance.ownerUserName}</p>
                <p className="text-slate-300">
                  Meta: {instance.conversionsToday}/{instance.conversionGoalDaily} conversões
                </p>
                {instance.status !== "connected" ? (
                  <p className="mt-1 rounded border border-[#FF9900]/30 bg-[#FF9900]/10 px-2 py-1 text-[11px] text-[#FFD39A]">
                    QR: {instance.qrCodeText}
                  </p>
                ) : null}
              </div>
            ))}
            {!payload?.instances.length ? <p className="text-slate-500">Nenhuma instância configurada.</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void connectFirstInstance()} disabled={saving}>
                Conectar QR
              </Button>
              <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void dispatchQueueNow()} disabled={saving}>
                Rodar fila agora
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Anti-ban ativo: delays 3-7s, typing progressivo e sinais composing/recording antes do envio.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2) Smart Inbox + SLA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por lead, telefone ou utm_content..."
                className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-slate-300">
                  <input type="checkbox" checked={awaitingOnly} onChange={(event) => setAwaitingOnly(event.target.checked)} />
                  Aguardando resposta
                </label>
                <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void fetchDashboard()}>
                  Filtrar
                </Button>
              </div>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {(payload?.smartInbox ?? []).map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                  }}
                  className={`w-full rounded border p-2 text-left ${
                    activeChatId === chat.id ? "border-[#FF9900]/40 bg-[#FF9900]/10" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-slate-100">
                      {chat.profile.leadName} ({chat.profile.leadId})
                    </p>
                    <Badge variant={toneForPriority(chat.priority)}>{chat.priority.toUpperCase()}</Badge>
                  </div>
                  <p className="truncate text-slate-300">{chat.latestMessagePreview}</p>
                  <p className="text-[11px] text-slate-400">
                    SLA: {chat.slaMinutes} min • {chat.awaitingResponse ? "Aguardando" : "Atendido"} • {stageLabel[chat.stage]}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3) Interactive Chat + Comandos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {selectedChat ? (
              <>
                <div className="rounded border border-white/10 bg-white/5 p-2">
                  <p className="text-slate-100">
                    {selectedChat.profile.leadName} • {selectedChat.profile.phone}
                  </p>
                  <p className="text-slate-400">
                    Stage: {stageLabel[selectedChat.stage]} • Closer: {selectedChat.assignedCloserUserName}
                  </p>
                  {selectedChat.automationPaused ? (
                    <Badge variant="danger">Automação pausada ({selectedChat.automationPausedReason || "lead respondeu"})</Badge>
                  ) : (
                    <Badge variant="success">Automação ativa</Badge>
                  )}
                </div>

                <div className="h-[300px] space-y-2 overflow-y-auto rounded border border-white/10 bg-black/30 p-2">
                  {(payload?.selectedMessages ?? []).map((message) => renderMessage(message))}
                </div>

                <div className="grid gap-2">
                  <textarea
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder="Digite a resposta manual..."
                    className="min-h-20 rounded border border-white/10 bg-slate-900/70 p-2"
                  />
                  <input
                    value={quickCommand}
                    onChange={(event) => setQuickCommand(event.target.value)}
                    placeholder="Comando rápido (/pix, /prova, /audio)"
                    className="h-8 rounded border border-white/10 bg-slate-900/70 px-2"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void sendOutboundMessage()} disabled={saving}>
                      Enviar mensagem
                    </Button>
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void simulateInbound()} disabled={saving}>
                      Simular resposta do lead
                    </Button>
                    <Button
                      type="button"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => void setAutomationPaused(!selectedChat.automationPaused)}
                      disabled={saving}
                    >
                      {selectedChat.automationPaused ? "Retomar automação" : "Pausar automação"}
                    </Button>
                  </div>
                </div>

                <div className="rounded border border-white/10 bg-white/5 p-2">
                  <p className="mb-1 text-slate-300">One-Click Funnel</p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedFunnelId}
                      onChange={(event) => setSelectedFunnelId(event.target.value)}
                      className="h-7 min-w-[180px] rounded border border-white/10 bg-slate-900/70 px-2 text-[11px]"
                    >
                      {(payload?.funnels ?? []).map((funnel) => (
                        <option key={funnel.id} value={funnel.id}>
                          {funnel.title}
                        </option>
                      ))}
                    </select>
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void launchFunnel()} disabled={saving}>
                      Disparar funil
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Se o lead responder no meio da sequência, o sistema pausa automaticamente os próximos envios.
                  </p>
                </div>

                <div className="rounded border border-white/10 bg-white/5 p-2">
                  <p className="mb-1 text-slate-300">Follow-up infinito</p>
                  <textarea
                    value={followUpText}
                    onChange={(event) => setFollowUpText(event.target.value)}
                    className="min-h-16 w-full rounded border border-white/10 bg-slate-900/70 p-2"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="datetime-local"
                      value={followUpAt}
                      onChange={(event) => setFollowUpAt(event.target.value)}
                      className="h-7 rounded border border-white/10 bg-slate-900/70 px-2 text-[11px]"
                    />
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void scheduleFollowUp()} disabled={saving}>
                      Agendar
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Selecione um chat na inbox.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">4) Intelligence, Contexto e Kanban</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-slate-300">Lead Profile & Offers Lab Context</p>
              {selectedChat ? (
                <div className="space-y-1 text-[11px]">
                  <p className="text-slate-200">
                    UTM: {selectedChat.profile.utmSource} / {selectedChat.profile.utmCampaign} / {selectedChat.profile.utmContent}
                  </p>
                  <p className="text-slate-400">
                    Criativo: {selectedChat.profile.creativeId} • Oferta: {selectedChat.profile.offerId}
                  </p>
                  <p className="text-slate-400">
                    VSL: {selectedChat.profile.vslWatchSeconds}s ({selectedChat.profile.vslCompletionPct.toFixed(1)}%)
                  </p>
                  <p className="text-slate-400">LTV preditivo: {currency(selectedChat.profile.predictedLtv90d)}</p>
                </div>
              ) : (
                <p className="text-slate-500">Selecione um lead para ver contexto.</p>
              )}
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-slate-300">AI Copilot (Quebra de objeção)</p>
              <p className="text-[11px] text-[#FFD39A]">{copilotSuggestion}</p>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-1 text-slate-300">Quick Assets</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => void sendQuickAsset("/pix")}
                  disabled={!selectedChat || saving}
                >
                  /pix
                </Button>
                <Button
                  type="button"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => void sendQuickAsset("/prova")}
                  disabled={!selectedChat || saving}
                >
                  /prova
                </Button>
                <Button
                  type="button"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => void sendQuickAsset("/audio")}
                  disabled={!selectedChat || saving}
                >
                  /audio
                </Button>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-1 text-slate-300">Kanban DR (arrastar e soltar)</p>
              <div className="grid gap-2 xl:grid-cols-2">
                {(Object.keys(stageLabel) as Array<keyof typeof stageLabel>).map((stage) => (
                  <div
                    key={stage}
                    className={`rounded border p-2 ${stageTone[stage]}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const droppedChatId = event.dataTransfer.getData("text/chat-id") || dragChatId;
                      if (droppedChatId) {
                        void moveStage(droppedChatId, stage);
                      }
                    }}
                  >
                    <p className="mb-1 text-slate-100">
                      {stageLabel[stage]} ({payload?.stageBoard[stage]?.length ?? 0})
                    </p>
                    <div className="space-y-1">
                      {(payload?.stageBoard[stage] ?? []).slice(0, 4).map((chat) => (
                        <div
                          key={chat.id}
                          draggable
                          onDragStart={(event) => {
                            setDragChatId(chat.id);
                            event.dataTransfer.setData("text/chat-id", chat.id);
                          }}
                          className="cursor-move rounded border border-white/10 bg-black/30 p-1 text-[11px]"
                        >
                          {chat.profile.leadName} • {chat.profile.utmContent}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  value={soldRevenue}
                  onChange={(event) => setSoldRevenue(Number(event.target.value || 0))}
                  className="h-7 w-40 rounded border border-white/10 bg-slate-900/70 px-2 text-[11px]"
                  placeholder="Receita venda"
                />
                <Button
                  type="button"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => (selectedChat ? void moveStage(selectedChat.id, "vendido") : undefined)}
                  disabled={!selectedChat || saving}
                >
                  Marcar selecionado como vendido
                </Button>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="mb-1 text-slate-300">Atribuição reversa (WhatsApp → Criativo)</p>
              <div className="space-y-1">
                {(payload?.attributionByCreative ?? []).slice(0, 6).map((row) => (
                  <div key={row.creativeId} className="rounded border border-white/10 bg-black/30 p-1 text-[11px]">
                    {row.creativeId}: {row.sales} vendas • {currency(row.grossRevenue)}
                  </div>
                ))}
              </div>
              {!(payload?.attributionByCreative.length ?? 0) ? <p className="text-slate-500">Sem vendas atribuídas ainda.</p> : null}
            </div>

            <p className="text-[11px] text-slate-400">
              {payload?.spyModeEnabled
                ? "Spy Mode CEO ativo: visualização cross-instâncias habilitada."
                : "Modo protegido: você só visualiza chats dos números sob sua responsabilidade."}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-3 text-xs text-slate-400">Carregando Sniper CRM...</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-300/30 bg-rose-500/10">
          <CardContent className="p-3 text-xs text-rose-100">{error}</CardContent>
        </Card>
      ) : null}
    </section>
  );
}

