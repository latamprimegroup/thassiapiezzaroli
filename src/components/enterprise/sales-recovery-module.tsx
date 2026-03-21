"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type RecoveryPayload = {
  smartInbox: Array<{
    id: string;
    stage: "lead" | "contato" | "boleto_pix_gerado" | "vendido";
    priority: "normal" | "high" | "urgent";
    awaitingResponse: boolean;
    automationPaused: boolean;
    contacted: boolean;
    firstContactAt: string;
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
      originAdName: string;
      creativeId: string;
      offerId: string;
      cartValue: number;
      abandonmentStep: "nome" | "email" | "telefone" | "pagamento" | "revisao";
      checkoutDroppedAt: string;
      vslWatchSeconds: number;
      vslCompletionPct: number;
      predictedLtv90d: number;
      managerUserName: string;
      niche: string;
    };
    slaMinutes: number;
  }>;
  selectedChat: (RecoveryPayload["smartInbox"][number] & {
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
      typingCps: number;
      randomDelaySec: number;
    };
  }>;
  funnels: Array<{
    id: string;
    title: string;
  }>;
};

function heatmapLabel(step: "nome" | "email" | "telefone" | "pagamento" | "revisao") {
  if (step === "pagamento") return "Pagamento (alta intenção)";
  if (step === "revisao") return "Revisão do pedido";
  if (step === "telefone") return "Telefone";
  if (step === "email") return "E-mail";
  return "Nome inicial";
}

function isHotLead(checkoutDroppedAt: string) {
  const droppedAt = new Date(checkoutDroppedAt).getTime();
  if (Number.isNaN(droppedAt)) {
    return false;
  }
  return Date.now() - droppedAt <= 5 * 60_000;
}

export function SalesRecoveryModule() {
  const { addActivity } = useWarRoom();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState("");
  const [payload, setPayload] = useState<RecoveryPayload | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [quickCommand, setQuickCommand] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [recoveredRevenue, setRecoveredRevenue] = useState(0);

  const fetchRecovery = useCallback(async (chatId?: string) => {
    const query = new URLSearchParams();
    if (chatId || activeChatId) {
      query.set("chatId", chatId || activeChatId);
    }
    const response = await fetch(`/api/sniper-crm/dashboard?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setLoading(false);
      setError("Falha ao carregar Central de Recuperacao Sniper.");
      return;
    }
    const data = (await response.json().catch(() => null)) as RecoveryPayload | null;
    if (!data) {
      setLoading(false);
      setError("Resposta invalida da Central de Recuperacao.");
      return;
    }
    setPayload(data);
    setLoading(false);
    if (!selectedFunnelId && data.funnels[0]?.id) {
      setSelectedFunnelId(data.funnels[0].id);
    }
  }, [activeChatId, selectedFunnelId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchRecovery();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchRecovery]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchRecovery();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [fetchRecovery]);

  const leads = useMemo(() => {
    return [...(payload?.smartInbox ?? [])].sort((a, b) => {
      const aHot = isHotLead(a.profile.checkoutDroppedAt) ? 1 : 0;
      const bHot = isHotLead(b.profile.checkoutDroppedAt) ? 1 : 0;
      if (aHot !== bHot) {
        return bHot - aHot;
      }
      if (a.profile.cartValue !== b.profile.cartValue) {
        return b.profile.cartValue - a.profile.cartValue;
      }
      return b.latestMessageAt.localeCompare(a.latestMessageAt);
    });
  }, [payload?.smartInbox]);

  async function postJson(url: string, body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!response) {
      throw new Error("Falha de rede ao comunicar com o Sniper CRM.");
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Falha na operacao.");
    }
    return response.json().catch(() => null);
  }

  async function openNativeChat(chatId: string) {
    setActiveChatId(chatId);
    setDrawerOpen(true);
    await fetchRecovery(chatId);
  }

  async function sendMessage() {
    if (!payload?.selectedChat || (!messageDraft.trim() && !quickCommand.trim())) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/messages", {
        chatId: payload.selectedChat.id,
        direction: "outbound",
        text: messageDraft.trim(),
        quickCommand: quickCommand.trim() || undefined,
      });
      addActivity("Closer", "Sniper CRM", "enviou mensagem nativa", payload.selectedChat.profile.leadId, quickCommand || "manual");
      setMessageDraft("");
      setQuickCommand("");
      await fetchRecovery(payload.selectedChat.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao enviar mensagem.");
    }
  }

  async function sendQuickCommand(command: "/pix" | "/prova" | "/audio") {
    if (!payload?.selectedChat) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/messages", {
        chatId: payload.selectedChat.id,
        direction: "outbound",
        quickCommand: command,
      });
      addActivity("Closer", "Sniper CRM", "enviou quick command", payload.selectedChat.profile.leadId, command);
      await fetchRecovery(payload.selectedChat.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao enviar comando rápido.");
    }
  }

  async function launchFunnel() {
    if (!payload?.selectedChat || !selectedFunnelId) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/funnels/launch", {
        chatId: payload.selectedChat.id,
        funnelId: selectedFunnelId,
      });
      addActivity("Closer", "Sniper CRM", "disparou funil", payload.selectedChat.profile.leadId, selectedFunnelId);
      await fetchRecovery(payload.selectedChat.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao disparar funil.");
    }
  }

  async function markRecovered() {
    if (!payload?.selectedChat) {
      return;
    }
    try {
      await postJson("/api/sniper-crm/stage", {
        chatId: payload.selectedChat.id,
        stage: "vendido",
        grossRevenue: recoveredRevenue,
      });
      addActivity(
        "Closer",
        "Sniper CRM",
        "marcou lead recuperado",
        payload.selectedChat.profile.leadId,
        `${currency(recoveredRevenue)}`,
      );
      await fetchRecovery(payload.selectedChat.id);
    } finally {
      setRecoveredRevenue(0);
    }
  }

  function renderMessage(message: RecoveryPayload["selectedMessages"][number]) {
    if (message.kind === "state") {
      return (
        <p key={message.id} className="text-[11px] text-slate-400">
          [{message.createdAt.slice(11, 16)}] {message.stateSignal}... ({message.meta.typingCps.toFixed(1)} cps)
        </p>
      );
    }
    const inbound = message.direction === "inbound";
    return (
      <div key={message.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
        <div
          className={`max-w-[85%] rounded border px-2 py-1 text-xs ${
            inbound ? "border-white/10 bg-black/40 text-slate-100" : "border-[#10B981]/30 bg-[#10B981]/10 text-[#D7FFE9]"
          }`}
        >
          <p className="text-[10px] text-slate-400">
            {message.sentByUserName} • {message.createdAt.slice(11, 16)}
          </p>
          {message.text ? <p>{message.text}</p> : null}
          {message.mediaUrl ? <p className="mt-1 text-[11px] text-[#FFD39A]">{message.mediaUrl}</p> : null}
        </div>
      </div>
    );
  }

  const selectedChat = payload?.selectedChat;

  function statusBadge(lead: RecoveryPayload["smartInbox"][number]) {
    if (lead.stage === "vendido") {
      return <Badge variant="success">Recuperado</Badge>;
    }
    if (lead.contacted) {
      return <Badge variant="sky">Ja Contatado</Badge>;
    }
    if (lead.awaitingResponse) {
      return <Badge variant="warning">Aguardando Resposta</Badge>;
    }
    return <Badge variant="default">Novo</Badge>;
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Central de Recuperacao Sniper (Inteligencia de Fechamento)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">Leads monitorados</p>
              <p className="text-lg text-slate-100">{leads.length}</p>
            </div>
            <div className="rounded border border-[#FF9900]/30 bg-[#FF9900]/10 p-2 text-xs">
              <p className="text-slate-300">Leads quentes (&lt; 5min)</p>
              <p className="text-lg text-[#FFD39A]">{leads.filter((item) => isHotLead(item.profile.checkoutDroppedAt)).length}</p>
            </div>
            <div className="rounded border border-[#10B981]/30 bg-[#10B981]/10 p-2 text-xs">
              <p className="text-slate-300">Ja contatados (webhook)</p>
              <p className="text-lg text-[#D7FFE9]">{leads.filter((item) => item.contacted).length}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">Ticket total em risco</p>
              <p className="text-lg text-slate-100">{currency(leads.reduce((acc, item) => acc + item.profile.cartValue, 0))}</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-slate-400">Carregando leads...</div>
          ) : leads.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              Sem leads de recuperacao no momento.
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className={`rounded border p-2 text-xs ${
                    isHotLead(lead.profile.checkoutDroppedAt)
                      ? "border-[#10B981]/50 bg-[#10B981]/10 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-slate-100">
                      {lead.profile.leadName} ({lead.profile.leadId})
                    </p>
                    <div className="flex items-center gap-2">
                      {statusBadge(lead)}
                      <Badge variant={lead.priority === "urgent" ? "danger" : lead.priority === "high" ? "warning" : "default"}>
                        {lead.priority.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-5">
                    <p className="text-slate-300">
                      Cart: <span className="text-slate-100">{currency(lead.profile.cartValue)}</span>
                    </p>
                    <p className="text-slate-300">
                      Heatmap: <span className="text-[#FFD39A]">{heatmapLabel(lead.profile.abandonmentStep)}</span>
                    </p>
                    <p className="text-slate-300">
                      Origem: <span className="text-slate-100">{lead.profile.originAdName || lead.profile.utmContent}</span>
                    </p>
                    <p className="text-slate-300">
                      SLA: <span className="text-slate-100">{lead.slaMinutes} min</span>
                    </p>
                    <p className="text-slate-300">
                      Gestor: <span className="text-slate-100">{lead.profile.managerUserName}</span>
                    </p>
                  </div>
                  <p className="mt-1 text-slate-400">
                    Preview: {lead.latestMessagePreview} {lead.contacted && lead.firstContactAt ? `• 1º contato: ${lead.firstContactAt.slice(11, 16)}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void openNativeChat(lead.id)} disabled={saving}>
                      Chamar no Zap (nativo)
                    </Button>
                    <Button
                      type="button"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setActiveChatId(lead.id);
                        setDrawerOpen(true);
                        setQuickCommand("/prova");
                        void fetchRecovery(lead.id);
                      }}
                    >
                      Abrir com script
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="h-full flex-1 bg-black/60"
            onClick={() => {
              setDrawerOpen(false);
            }}
          />
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#050505] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Chat Sniper Overlay</h3>
              <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => setDrawerOpen(false)}>
                Fechar
              </Button>
            </div>
            {selectedChat ? (
              <div className="space-y-3">
                <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                  <p className="text-slate-100">
                    {selectedChat.profile.leadName} • {selectedChat.profile.phone}
                  </p>
                  <p className="text-slate-400">
                    Origem: {selectedChat.profile.originAdName} | UTM: {selectedChat.profile.utmSource}/{selectedChat.profile.utmCampaign}/
                    {selectedChat.profile.utmContent}
                  </p>
                  <p className="text-slate-300">
                    Valor do carrinho: {currency(selectedChat.profile.cartValue)} | Heatmap: {heatmapLabel(selectedChat.profile.abandonmentStep)}
                  </p>
                </div>

                <div className="h-72 space-y-2 overflow-y-auto rounded border border-white/10 bg-black/30 p-2">
                  {(payload?.selectedMessages ?? []).map((message) => renderMessage(message))}
                </div>

                <div className="space-y-2 rounded border border-white/10 bg-white/5 p-2">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Digite sua resposta para o lead..."
                    className="min-h-20 w-full rounded border border-white/10 bg-slate-900/70 p-2 text-xs"
                  />
                  <input
                    value={quickCommand}
                    onChange={(event) => setQuickCommand(event.target.value)}
                    placeholder="/pix, /prova, /audio, /boleto"
                    className="h-8 w-full rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void sendMessage()} disabled={saving}>
                      Enviar mensagem
                    </Button>
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void sendQuickCommand("/audio")} disabled={saving}>
                      Áudio Expert (.ogg)
                    </Button>
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void sendQuickCommand("/pix")} disabled={saving}>
                      /pix
                    </Button>
                    <Button type="button" className="h-7 px-2 text-[11px]" onClick={() => void sendQuickCommand("/prova")} disabled={saving}>
                      /prova
                    </Button>
                  </div>
                </div>

                <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                  <p className="mb-1 text-slate-300">Atalhos de funil (DKW style)</p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedFunnelId}
                      onChange={(event) => setSelectedFunnelId(event.target.value)}
                      className="h-8 min-w-[220px] rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
                    >
                      {(payload?.funnels ?? []).map((funnel) => (
                        <option key={funnel.id} value={funnel.id}>
                          {funnel.title}
                        </option>
                      ))}
                    </select>
                    <Button type="button" className="h-8 px-3 text-xs" onClick={() => void launchFunnel()} disabled={saving}>
                      Disparar funil
                    </Button>
                  </div>
                </div>

                <div className="rounded border border-[#10B981]/30 bg-[#10B981]/10 p-2 text-xs">
                  <p className="mb-1 text-slate-200">Feedback loop financeiro imediato</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      value={recoveredRevenue}
                      onChange={(event) => setRecoveredRevenue(Number(event.target.value || 0))}
                      placeholder="Receita recuperada"
                      className="h-8 w-44 rounded border border-white/10 bg-slate-900/70 px-2 text-xs"
                    />
                    <Button type="button" className="h-8 px-3 text-xs" onClick={() => void markRecovered()} disabled={saving}>
                      Marcar checkout como Recuperado
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Ao recuperar, o lucro entra no Daily Settlement e no dashboard executivo com vínculo ao gestor de tráfego de origem.
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded border border-white/10 bg-white/5 p-2 text-xs text-slate-400">Selecione um lead para iniciar.</p>
            )}
          </div>
        </div>
      )}

      {error ? (
        <Card className="border-rose-300/30 bg-rose-500/10">
          <CardContent className="p-3 text-xs text-rose-100">{error}</CardContent>
        </Card>
      ) : null}
    </section>
  );
}
