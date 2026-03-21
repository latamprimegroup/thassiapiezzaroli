"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type SniperLead = {
  leadId: string;
  score: number;
  stage: string;
  predictedLtv90d: number;
  watchCompletionPct: number;
  objection: string;
};

function objectionByStage(stage: string) {
  if (stage === "most_aware" || stage === "product_aware") {
    return "cartao_recusado";
  }
  if (stage === "solution_aware") {
    return "falta_confianca";
  }
  return "duvida_geral";
}

function messageTemplate(lead: SniperLead) {
  if (lead.objection === "cartao_recusado") {
    return `Lead ${lead.leadId}: vimos que voce quase concluiu sua compra. Posso te ajudar agora com uma alternativa rapida de pagamento?`;
  }
  if (lead.objection === "falta_confianca") {
    return `Lead ${lead.leadId}: posso te enviar agora as provas e o passo a passo para voce decidir com seguranca?`;
  }
  return `Lead ${lead.leadId}: vi que voce assistiu grande parte da apresentacao. Quer que eu te ajude a escolher a melhor opcao em 2 minutos?`;
}

export function SalesRecoveryModule() {
  const { data, addActivity } = useWarRoom();
  const [sendingLeadId, setSendingLeadId] = useState("");

  const sniperList = useMemo<SniperLead[]>(() => {
    const leads = data.customerCentrality?.leads ?? [];
    return leads
      .filter((lead) => lead.watchCompletionPct >= 60 && lead.purchases === 0)
      .map((lead) => {
        const score = Math.min(100, lead.watchCompletionPct * 0.45 + lead.clickedEmails7d * 14 + lead.predictedLtv90d / 80);
        return {
          leadId: lead.leadId,
          stage: lead.awarenessStage,
          predictedLtv90d: lead.predictedLtv90d,
          watchCompletionPct: lead.watchCompletionPct,
          score,
          objection: objectionByStage(lead.awarenessStage),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [data.customerCentrality?.leads]);

  async function oneTapWhatsApp(lead: SniperLead) {
    setSendingLeadId(lead.leadId);
    try {
      const message = messageTemplate(lead);
      const response = await fetch("/api/notify-squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (response.ok) {
        addActivity("Closer", "Recovery Squad", "enviou contato one-tap", lead.leadId, lead.objection);
      } else {
        addActivity("Closer", "Recovery Squad", "falhou envio one-tap", lead.leadId, "webhook");
      }
    } finally {
      setSendingLeadId("");
    }
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales Recovery - The Sniper List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-slate-400">
            Prioridade maxima: leads que assistiram o pitch e tem alta propensao de compra sem conclusao.
          </p>
          {sniperList.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-slate-400">Sem leads sniper no momento.</div>
          ) : (
            sniperList.map((lead) => (
              <div key={lead.leadId} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-slate-100">{lead.leadId}</p>
                  <Badge variant={lead.score >= 75 ? "danger" : lead.score >= 60 ? "warning" : "sky"}>
                    SCORE {lead.score.toFixed(0)}
                  </Badge>
                </div>
                <p className="text-slate-300">
                  Stage: {lead.stage} | Pitch: {lead.watchCompletionPct.toFixed(1)}% | LTV90: {currency(lead.predictedLtv90d)}
                </p>
                <p className="text-slate-400">Objecao dominante: {lead.objection}</p>
                <Button
                  type="button"
                  className="mt-2 h-7 px-2 text-[11px]"
                  onClick={() => void oneTapWhatsApp(lead)}
                  disabled={sendingLeadId === lead.leadId}
                >
                  {sendingLeadId === lead.leadId ? "Enviando..." : "One-Tap WhatsApp"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
