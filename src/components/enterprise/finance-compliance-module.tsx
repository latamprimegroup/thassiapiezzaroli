"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type LegalDoc = {
  id: string;
  name: string;
  owner: string;
  reviewedAt: string;
  status: "ok" | "pending";
};

export function FinanceComplianceModule() {
  const { data, addActivity } = useWarRoom();
  const [docs, setDocs] = useState<LegalDoc[]>([
    { id: "LEGAL-001", name: "Termos de Uso - Oferta Core", owner: "Juridico", reviewedAt: "2026-03-18", status: "ok" },
    { id: "LEGAL-002", name: "Politica de Reembolso", owner: "Juridico", reviewedAt: "2026-03-15", status: "ok" },
    { id: "LEGAL-003", name: "Contrato de Co-producao", owner: "Financeiro", reviewedAt: "2026-03-10", status: "pending" },
  ]);

  const dre = useMemo(() => {
    const gross = data.integrations.gateway.consolidatedGrossRevenue;
    const adSpend = data.enterprise.ceoFinance.adSpend;
    const gateway = data.enterprise.ceoFinance.gatewayFees;
    const taxes = data.enterprise.ceoFinance.nfseTaxes;
    const commissions = Math.round(gross * 0.06);
    const net = Math.max(0, gross - adSpend - gateway - taxes - commissions);
    return { gross, adSpend, gateway, taxes, commissions, net };
  }, [
    data.enterprise.ceoFinance.adSpend,
    data.enterprise.ceoFinance.gatewayFees,
    data.enterprise.ceoFinance.nfseTaxes,
    data.integrations.gateway.consolidatedGrossRevenue,
  ]);

  function markReviewed(docId: string) {
    setDocs((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, status: "ok", reviewedAt: new Date().toISOString().slice(0, 10) } : doc)),
    );
    addActivity("Finance", "Compliance", "revisou documento legal", docId, "legal vault");
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finance & Compliance - Net Profit Live (DRE)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">Receita Bruta</p>
              <p className="text-slate-100">{currency(dre.gross)}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">Custos Variaveis</p>
              <p className="text-slate-100">
                Ads {currency(dre.adSpend)} | Gateway {currency(dre.gateway)} | Impostos {currency(dre.taxes)}
              </p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">Lucro Liquido (live)</p>
              <p className="text-[#10B981]">{currency(dre.net)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Formula: Receita Bruta - AdSpend - Gateway - Impostos - Comissoes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legal Vault</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-100">{doc.name}</p>
                <Badge variant={doc.status === "ok" ? "success" : "warning"}>{doc.status.toUpperCase()}</Badge>
              </div>
              <p className="text-slate-400">
                Owner: {doc.owner} | Revisado em: {doc.reviewedAt}
              </p>
              {doc.status !== "ok" ? (
                <Button type="button" className="mt-2 h-7 px-2 text-[11px]" onClick={() => markReviewed(doc.id)}>
                  Marcar como revisado
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
