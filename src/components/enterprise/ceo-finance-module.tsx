"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GaugeChart } from "@/components/ui/gauge-chart";
import { Sparkline } from "@/components/ui/sparkline";
import { useWarRoom } from "@/context/war-room-context";
import { computeIntelligenceEngine, ELITE_BENCHMARKS } from "@/lib/metrics/intelligence-engine";

type CeoFinanceModuleProps = {
  canViewSensitiveFinancials: boolean;
};

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function CeoFinanceModule({ canViewSensitiveFinancials }: CeoFinanceModuleProps) {
  const { data, addActivity } = useWarRoom();
  const f = data.enterprise.ceoFinance;
  const intelligence = computeIntelligenceEngine(data);
  const contingencyItems = [...data.contingency.domains, ...data.contingency.adAccounts, ...data.contingency.fanpages];
  const blockedCount = contingencyItems.filter((item) => item.status === "blocked").length;
  const warningCount = contingencyItems.filter((item) => item.status === "warning").length;
  const appmaxApproval = data.integrations.gateway.appmaxCardApprovalRate;
  const merCross = data.integrations.merCross;
  const fortress = data.integrations.fortress;
  const [simAdSpend, setSimAdSpend] = useState(fortress.scaleSimulator.defaultAdSpend);
  const [simCpaGrowthPct, setSimCpaGrowthPct] = useState(15);
  const [mechanismQuery, setMechanismQuery] = useState("INSULINA");

  const cohortMax = Math.max(f.ltvCohorts.d30, f.ltvCohorts.d60, f.ltvCohorts.d90, 1);
  const cohorts = [
    { label: "30d", value: f.ltvCohorts.d30 },
    { label: "60d", value: f.ltvCohorts.d60 },
    { label: "90d", value: f.ltvCohorts.d90 },
  ];
  const simulation = useMemo(() => {
    const baselineCpa = Math.max(1, fortress.scaleSimulator.defaultCpa);
    const effectiveCpa = baselineCpa * (1 + simCpaGrowthPct / 100);
    const projectedPurchases = Math.max(1, Math.round(simAdSpend / effectiveCpa));
    const baselineAvgTicket = Math.max(1, data.integrations.gateway.consolidatedGrossRevenue / Math.max(1, fortress.pixelSync.realPurchases));
    const projectedGross = projectedPurchases * baselineAvgTicket;
    const gatewayFeeRate = f.grossRevenue > 0 ? f.gatewayFees / f.grossRevenue : 0.036;
    const gatewayFees = projectedGross * gatewayFeeRate;
    const taxes = projectedGross * (data.integrations.gateway.taxRatePct / 100);
    const projectedNet = projectedGross - gatewayFees - taxes - simAdSpend - data.integrations.gateway.fixedCosts;
    const roiPct = projectedGross > 0 ? (projectedNet / projectedGross) * 100 : 0;
    const deltaVsCurrent = projectedNet - f.netProfit;
    return { effectiveCpa, projectedPurchases, projectedGross, projectedNet, roiPct, deltaVsCurrent };
  }, [data.integrations.gateway.consolidatedGrossRevenue, data.integrations.gateway.fixedCosts, data.integrations.gateway.taxRatePct, f.gatewayFees, f.grossRevenue, f.netProfit, fortress.pixelSync.realPurchases, fortress.scaleSimulator.defaultCpa, simAdSpend, simCpaGrowthPct]);
  const mechanismBreakdown = useMemo(() => {
    const roiByCreative = new Map(data.integrations.attribution.realRoiLeaderboard.map((item) => [item.creativeId, item]));
    const grouped = new Map<string, { totalProfit: number; count: number; ids: string[] }>();
    for (const entry of data.enterprise.copyResearch.namingRegistry) {
      const key = entry.mechanism.toUpperCase();
      const matched =
        roiByCreative.get(entry.linkedCreativeId) ||
        roiByCreative.get(entry.dnaName) ||
        data.integrations.attribution.realRoiLeaderboard.find((item) => item.creativeId.includes(entry.mechanism));
      const profit = matched?.realProfit ?? 0;
      const current = grouped.get(key) ?? { totalProfit: 0, count: 0, ids: [] };
      current.totalProfit += profit;
      current.count += 1;
      current.ids.push(entry.uniqueId);
      grouped.set(key, current);
    }
    return [...grouped.entries()]
      .map(([mechanism, value]) => ({
        mechanism,
        totalProfit: value.totalProfit,
        count: value.count,
        ids: value.ids,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }, [data.enterprise.copyResearch.namingRegistry, data.integrations.attribution.realRoiLeaderboard]);
  const filteredMechanismBreakdown = mechanismBreakdown.filter((item) =>
    item.mechanism.includes(mechanismQuery.trim().toUpperCase()),
  );

  return (
    <section className="war-fade-in space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-[#050505]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">MER (Marketing Efficiency Ratio)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[#34A853]">{f.mer.toFixed(2)}</p>
            <p className="mt-1 text-xs text-slate-400">
              Zona critica &lt; {ELITE_BENCHMARKS.merCritical.toFixed(1)}x | Escala forte &gt;{" "}
              {ELITE_BENCHMARKS.merScale.toFixed(1)}x
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#050505]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Lucro Liquido Real</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[#34A853]">{currency(f.netProfit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#050505]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Payback (dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${f.paybackDays <= 20 ? "text-[#34A853]" : "text-[#FF9900]"}`}>{f.paybackDays}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#050505]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Provisao Tributaria</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[#FF9900]">{currency(f.taxProvision)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Governanca de Escala (DSS via MER)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{intelligence.scalePolicy.reason}</p>
          {intelligence.scalePolicy.locked ? (
            <Badge variant="danger">
              Escala travada: MER abaixo de {ELITE_BENCHMARKS.merCritical.toFixed(1)}x
            </Badge>
          ) : (
            <Badge variant="success">Escala liberada: sugestao +{intelligence.scalePolicy.suggestedBudgetIncreasePct}% budget</Badge>
          )}
          {intelligence.assessments.icRate.value < ELITE_BENCHMARKS.icRate && (
            <Badge variant="warning">
              Alerta cruzado CEO/Tech: IC Rate em {intelligence.assessments.icRate.value.toFixed(2)}%
            </Badge>
          )}
          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="text-xs text-slate-300">MER cross (Kiwify + Appmax / Spend Utmify)</p>
            <div className="mt-1 flex items-center justify-between">
              <span className={merCross.status === "critical" ? "text-[#EA4335]" : merCross.status === "elite" ? "text-[#10B981]" : "text-[#FF9900]"}>
                {merCross.value.toFixed(2)}x
              </span>
              <Sparkline values={merCross.trend12h} className="h-7 w-24" strokeClassName="stroke-[#FF9900]" />
            </div>
            <p className="text-xs text-slate-400">{merCross.recommendation}</p>
          </div>
          <GaugeChart value={merCross.value} min={0} max={5} label="Gauge MER Global" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LTV Cohort Tracker (30/60/90)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cohorts.map((cohort) => (
            <div key={cohort.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                <span>{cohort.label}</span>
                <span>{currency(cohort.value)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-[#FF9900]"
                  style={{ width: `${(cohort.value / cohortMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard de Recuperacao (Boleto/Pix)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {f.recoveryLeaderboard.map((agent) => (
            <div key={agent.agent} className="rounded-md border border-white/10 bg-white/5 p-2 text-sm">
              <p className="font-medium text-slate-100">{agent.agent}</p>
              <p className="text-xs text-slate-300">
                Boleto: {percent(agent.boletoRecoveryRate)} | Pix: {percent(agent.pixRecoveryRate)} | Recuperado:{" "}
                {currency(agent.recoveredRevenue)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saude de Pagamentos (Appmax/Kiwify)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Aprovacao cartao Appmax: {percent(appmaxApproval)}</p>
          <p>Faturamento liquido consolidado: {currency(data.integrations.gateway.consolidatedNetRevenue)}</p>
          <p className="text-slate-400">
            Lucro real = Receita Bruta - Gateway - Impostos ({data.integrations.gateway.taxRatePct.toFixed(2)}%) - AdSpend -
            Custos Fixos ({currency(data.integrations.gateway.fixedCosts)})
          </p>
          {appmaxApproval > 0 && appmaxApproval < 80 ? (
            <Badge variant="danger">ALERTA FINANCEIRO: aprovacao de cartao abaixo de 80%</Badge>
          ) : (
            <Badge variant="success">Processamento de pagamentos em faixa estavel</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">THE VAULT: Domain & Pixel Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Status do Cofre:{" "}
            <span className={fortress.vault.overallStatus === "blocked" ? "text-[#EA4335]" : fortress.vault.overallStatus === "warning" ? "text-[#FF9900]" : "text-[#10B981]"}>
              {fortress.vault.overallStatus.toUpperCase()}
            </span>{" "}
            | Ultimo check: {fortress.vault.lastCheckAt} | Intervalo: {fortress.vault.intervalMinutes} min
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {fortress.vault.domains.map((domain) => (
              <div key={domain.domain} className="rounded-md border border-white/10 bg-white/5 p-2">
                <p className="font-medium text-slate-100">{domain.domain}</p>
                <p className="text-xs text-slate-300">
                  Safe Browsing: {domain.safeBrowsingStatus} | FB Debugger: {domain.facebookDebuggerStatus} | Cloudflare:{" "}
                  {domain.cloudflareStatus}
                </p>
                <p className="text-xs text-slate-400">{domain.note}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="text-slate-200">
              Pixel Sync:{" "}
              <span className={fortress.pixelSync.status === "unhealthy" ? "text-[#EA4335]" : fortress.pixelSync.status === "healthy" ? "text-[#10B981]" : "text-[#FF9900]"}>
                {fortress.pixelSync.status.toUpperCase()}
              </span>
            </p>
            <p className="text-xs text-slate-300">
              Vendas Reais: {fortress.pixelSync.realPurchases} | Meta Reportadas: {fortress.pixelSync.metaReportedPurchases} | Divergencia:{" "}
              {fortress.pixelSync.discrepancyPct.toFixed(2)}%
            </p>
            <p className="text-xs text-slate-400">{fortress.pixelSync.note}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LTV & Back-end Explorer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">LTV 7d</p>
              <p className="text-lg font-semibold text-slate-100">{currency(fortress.backEndLtv.ltvTracker.d7)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">LTV 30d</p>
              <p className="text-lg font-semibold text-slate-100">{currency(fortress.backEndLtv.ltvTracker.d30)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">LTV 90d</p>
              <p className="text-lg font-semibold text-[#10B981]">{currency(fortress.backEndLtv.ltvTracker.d90)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">Share CRM</p>
              <p className="text-lg font-semibold text-[#FF9900]">{fortress.backEndLtv.revenueBySource.crmSharePct.toFixed(2)}%</p>
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="mb-1 text-slate-300">Revenue by Source</p>
            <p className="text-xs text-slate-300">
              Pago: {currency(fortress.backEndLtv.revenueBySource.paidTraffic)} | E-mail: {currency(fortress.backEndLtv.revenueBySource.crmEmail)} | SMS:{" "}
              {currency(fortress.backEndLtv.revenueBySource.crmSms)} | WhatsApp: {currency(fortress.backEndLtv.revenueBySource.crmWhatsapp)}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="mb-1 text-slate-300">AI Predictive LTV (7d -&gt; 90d)</p>
            <p className="text-xs text-slate-300">
              Baseline 7d: {currency(fortress.backEndLtv.predictiveModel.baselineFromD7)} | Predicao 90d:{" "}
              {currency(fortress.backEndLtv.predictiveModel.predictedLtv90d)} | Confianca:{" "}
              {fortress.backEndLtv.predictiveModel.confidencePct.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">
              Drivers: {fortress.backEndLtv.predictiveModel.drivers.join(" | ")}
            </p>
          </div>
          <div className="space-y-1">
            {fortress.backEndLtv.upsellFlowMap.map((item) => (
              <div key={item.step}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>{item.step}</span>
                  <span>
                    {item.takeRate.toFixed(2)}% | {currency(item.estimatedRevenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className={`h-2 rounded-full ${item.status === "scale" ? "bg-[#10B981]" : "bg-[#FF9900]"}`} style={{ width: `${Math.min(100, item.takeRate)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribution Drift Guard (Nomenclatura)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.integrations.attribution.namingDriftAlerts.length === 0 ? (
            <Badge variant="success">Sem divergencias de nomenclatura detectadas</Badge>
          ) : (
            data.integrations.attribution.namingDriftAlerts.slice(0, 6).map((alert) => (
              <div key={`${alert.creativeId}-${alert.reason}`} className="rounded border border-white/10 bg-white/5 p-2">
                <p className={alert.severity === "critical" ? "text-[#EA4335]" : "text-[#FF9900]"}>
                  {alert.creativeId} - {alert.reason}
                </p>
                {alert.suggestedDnaName ? <p className="font-mono text-xs text-slate-300">Sugestao: {alert.suggestedDnaName}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scale Simulator (What-If)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">AdSpend pretendido (R$)</span>
              <input
                type="number"
                value={Math.round(simAdSpend)}
                min={1000}
                onChange={(event) => setSimAdSpend(Math.max(1000, Number(event.target.value) || 1000))}
                className="w-full rounded border border-white/15 bg-[#050505] px-2 py-1 text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Stress de CPA (%)</span>
              <input
                type="number"
                value={simCpaGrowthPct}
                min={-30}
                max={80}
                onChange={(event) => setSimCpaGrowthPct(Number(event.target.value) || 0)}
                className="w-full rounded border border-white/15 bg-[#050505] px-2 py-1 text-slate-100"
              />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">CPA Simulado</p>
              <p className="font-semibold text-slate-100">{currency(simulation.effectiveCpa)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">Compras Projetadas</p>
              <p className="font-semibold text-slate-100">{simulation.projectedPurchases.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">Lucro Liquido Projetado</p>
              <p className={`font-semibold ${simulation.projectedNet >= 0 ? "text-[#10B981]" : "text-[#EA4335]"}`}>{currency(simulation.projectedNet)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-xs text-slate-400">ROI Projetado</p>
              <p className={`font-semibold ${simulation.roiPct >= 0 ? "text-[#10B981]" : "text-[#EA4335]"}`}>{simulation.roiPct.toFixed(2)}%</p>
            </div>
          </div>
          <p className={simulation.deltaVsCurrent >= 0 ? "text-[#10B981]" : "text-[#EA4335]"}>
            Delta vs lucro atual: {currency(simulation.deltaVsCurrent)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta Sync por Mecanismo (Nomenclatura Universal)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Buscar mecanismo no DNA do criativo</span>
            <input
              value={mechanismQuery}
              onChange={(event) => setMechanismQuery(event.target.value)}
              placeholder="INSULINA"
              className="w-full rounded border border-white/15 bg-[#050505] px-2 py-1 text-slate-100"
            />
          </label>
          <div className="space-y-2">
            {(filteredMechanismBreakdown.length > 0 ? filteredMechanismBreakdown : mechanismBreakdown.slice(0, 5)).map((item) => (
              <div key={item.mechanism} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="font-mono text-slate-100">{item.mechanism}</p>
                <p className="text-xs text-slate-300">
                  Lucro agregado: {currency(item.totalProfit)} | IDs: {item.ids.join(", ")}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            O agrupamento usa o mecanismo no nome padronizado para conectar criativo, midia e receita por DNA.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opportunity Lost Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Perda estimada hoje:{" "}
            <span className="text-[#EA4335]">{currency(data.integrations.operations.opportunityLost.estimatedLossToday)}</span>
          </p>
          <p>
            Burn atual por minuto:{" "}
            <span className={data.integrations.operations.opportunityLost.currentlyLosing ? "text-[#EA4335]" : "text-[#10B981]"}>
              {currency(data.integrations.operations.opportunityLost.currentLossPerMinute)}
            </span>
          </p>
          {data.integrations.operations.opportunityLost.currentlyLosing ? (
            <Badge variant="danger">ALERTA: sistema detecta perda ativa de oportunidade</Badge>
          ) : (
            <Badge variant="success">Sem perda ativa no momento</Badge>
          )}
          {data.integrations.operations.opportunityLost.incidents.map((incident) => (
            <div key={incident.id} className="rounded border border-white/10 bg-white/5 p-2">
              <p className={incident.severity === "critical" ? "text-[#EA4335]" : "text-[#FF9900]"}>{incident.reason}</p>
              <p className="text-xs text-slate-400">
                {incident.startedAt} | Estimativa: {currency(incident.estimatedLoss)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliacao Financeira / Atribuicao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Status:{" "}
            <span
              className={
                data.integrations.operations.reconciliation.status === "critical"
                  ? "text-[#EA4335]"
                  : data.integrations.operations.reconciliation.status === "warning"
                    ? "text-[#FF9900]"
                    : "text-[#10B981]"
              }
            >
              {data.integrations.operations.reconciliation.status.toUpperCase()}
            </span>{" "}
            | Ultima checagem: {data.integrations.operations.reconciliation.lastCheckedAt}
          </p>
          {data.integrations.operations.reconciliation.ledger.map((row) => (
            <div key={row.id} className="rounded border border-white/10 bg-white/5 p-2">
              <p className="font-mono text-xs text-slate-300">{row.id}</p>
              <p className="text-xs text-slate-200">
                Esperado {currency(row.expected)} | Observado {currency(row.observed)} | Variancia {row.variancePct.toFixed(2)}%
              </p>
              <p className="text-xs text-slate-400">{row.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Worker Queue (Async Ops)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Fila atual: {data.integrations.operations.worker.queueDepth}</p>
          <p>Falhas/DLQ: {data.integrations.operations.worker.failedJobs}</p>
          <p>Processados hoje: {data.integrations.operations.worker.processedToday}</p>
          <p className="text-xs text-slate-400">Ultimo ciclo: {data.integrations.operations.worker.lastRunAt || "N/A"}</p>
        </CardContent>
      </Card>

      {canViewSensitiveFinancials ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Soberania de Caixa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Receita Bruta: {currency(f.grossRevenue)}</p>
            <p>Gasto Ads: {currency(f.adSpend)}</p>
            <p>Gateway: {currency(f.gatewayFees)} | NFS-e: {currency(f.nfseTaxes)}</p>
            <p>
              Acao rapida:
              <button
                onClick={() => addActivity("CEO", "Admin", "pausou squads de risco", "Escala DR", "preservar margem")}
                className="ml-2 rounded border border-[#FF9900]/40 bg-[#FF9900]/20 px-2 py-0.5 text-xs text-[#FFD39A]"
              >
                Pausar squads em risco
              </button>
            </p>
            <Badge variant="warning">Contribuicao: {percent(data.finance.contributionMargin)}</Badge>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-slate-400">
            Dados de caixa e margem disponiveis somente para perfil CEO/Admin.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativo de Contingencia (Dominios, BMs e Perfis)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-slate-300">
            Bloqueados: <span className="text-[#EA4335]">{blockedCount}</span> | Warning:{" "}
            <span className="text-[#FF9900]">{warningCount}</span> | Saudaveis:{" "}
            <span className="text-[#10B981]">{contingencyItems.length - blockedCount - warningCount}</span>
          </p>
          {blockedCount > 0 ? (
            <Badge variant="danger">Ativar plano de contingencia imediatamente</Badge>
          ) : (
            <Badge variant="success">Contingencia sob controle</Badge>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
