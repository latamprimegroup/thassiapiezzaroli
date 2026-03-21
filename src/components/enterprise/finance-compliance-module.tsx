"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { useWarRoom } from "@/context/war-room-context";
import type { ComplianceScanResult } from "@/lib/compliance/compliance-scanner";
import { computeEquityValuation } from "@/lib/metrics/corporate-intelligence";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type LegalDoc = {
  id: string;
  name: string;
  category: "contrato" | "termos" | "api";
  owner: string;
  reviewedAt: string;
  status: "ok" | "pending";
};

export function FinanceComplianceModule() {
  const { data, addActivity } = useWarRoom();
  const [docs, setDocs] = useState<LegalDoc[]>([
    {
      id: "LEGAL-001",
      name: "Contrato de Heads de Squad",
      category: "contrato",
      owner: "Juridico",
      reviewedAt: "2026-03-18",
      status: "ok",
    },
    {
      id: "LEGAL-002",
      name: "Termos de Uso - Oferta Core",
      category: "termos",
      owner: "Juridico",
      reviewedAt: "2026-03-15",
      status: "ok",
    },
    {
      id: "LEGAL-003",
      name: "Documentacao API de Integracoes",
      category: "api",
      owner: "Engineering",
      reviewedAt: "2026-03-10",
      status: "pending",
    },
  ]);
  const [scanUrlInput, setScanUrlInput] = useState("https://example.com");
  const [scanResults, setScanResults] = useState<ComplianceScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const equity = useMemo(() => computeEquityValuation(data), [data]);

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

  async function runComplianceScan() {
    const urls = scanUrlInput
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);
    if (urls.length === 0) {
      return;
    }
    setIsScanning(true);
    try {
      const response = await fetch("/api/compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const payload = (await response.json().catch(() => null)) as { results?: ComplianceScanResult[] } | null;
      if (response.ok && payload?.results) {
        setScanResults(payload.results);
        addActivity("Finance", "Compliance AI", "executou scanner de compliance", "ofertas", `${payload.results.length} URL(s)`);
      } else {
        addActivity("Finance", "Compliance AI", "falhou scanner de compliance", "ofertas", "erro de endpoint");
      }
    } finally {
      setIsScanning(false);
    }
  }

  const suspiciousBudgetChanges = data.activityLog.filter((entry) => {
    const normalizedAction = `${entry.action} ${entry.reason}`.toLowerCase();
    const isBudgetChange =
      normalizedAction.includes("orcamento") || normalizedAction.includes("budget") || normalizedAction.includes("atualizou cpa");
    if (!isBudgetChange) {
      return false;
    }
    const hour = Number(entry.timestamp.split(":")[0] ?? "0");
    return Number.isFinite(hour) && hour >= 0 && hour < 6;
  });

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
          <CardTitle className="text-base">Asset Valuation (Equity Real-Time)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">LTM EBITDA</p>
              <p className="text-slate-100">{currency(equity.ltmEbitda)}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">Multiplo setorial</p>
              <p className="text-slate-100">{equity.multiple.toFixed(2)}x</p>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-400">Valor da base (leads)</p>
              <p className="text-slate-100">{currency(equity.databaseValue)}</p>
            </div>
            <div className="rounded border border-[#10B981]/40 bg-[#10B981]/10 p-2 text-xs">
              <p className="text-slate-300">Valor de mercado estimado</p>
              <p className="text-xl font-semibold text-white">{currency(equity.estimatedValuation)}</p>
            </div>
          </div>
          <Sparkline values={equity.equity12m} className="h-12 w-full" strokeClassName="stroke-[#10B981]" />
          <p className="text-xs text-slate-400">
            Formula: (LTM EBITDA x Multiplo) + Valor por Lead Ativo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance AI Scanner (Meta/Google)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <textarea
            value={scanUrlInput}
            onChange={(event) => setScanUrlInput(event.target.value)}
            className="min-h-20 w-full rounded border border-white/10 bg-slate-900/70 p-2 text-xs"
            placeholder="Cole as URLs (uma por linha) para varredura de compliance."
          />
          <Button type="button" className="h-8 px-3 text-xs" onClick={() => void runComplianceScan()} disabled={isScanning}>
            {isScanning ? "Escaneando..." : "Rodar Scanner"}
          </Button>
          <div className="space-y-2">
            {scanResults.map((item) => (
              <div key={item.url} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-slate-100">{item.url}</p>
                  <Badge
                    variant={
                      item.status === "SAFE" ? "success" : item.status === "MODERATE RISK" ? "warning" : "danger"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="text-slate-300">Risk Score: {item.riskScore}</p>
                <p className="text-slate-400">{item.summary}</p>
                <p className="text-slate-500">Termos: {item.matchedTerms.join(", ") || "nenhum"}</p>
                {item.disclaimerRequired ? <Badge variant="danger">Disclaimer obrigatorio</Badge> : null}
              </div>
            ))}
          </div>
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
                <div className="flex items-center gap-1">
                  <Badge variant="default">{doc.category.toUpperCase()}</Badge>
                  <Badge variant={doc.status === "ok" ? "success" : "warning"}>{doc.status.toUpperCase()}</Badge>
                </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Log de Governanca</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {suspiciousBudgetChanges.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">
              Sem alteracoes suspeitas de orcamento na madrugada.
            </div>
          ) : (
            suspiciousBudgetChanges.map((entry) => (
              <div key={entry.id} className="rounded border border-[#FF9900]/40 bg-[#FF9900]/10 p-2 text-amber-100">
                [{entry.timestamp}] {entry.actorName} alterou &quot;{entry.entity}&quot; ({entry.action}) - {entry.reason}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
