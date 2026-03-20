"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const cohortMax = Math.max(f.ltvCohorts.d30, f.ltvCohorts.d60, f.ltvCohorts.d90, 1);
  const cohorts = [
    { label: "30d", value: f.ltvCohorts.d30 },
    { label: "60d", value: f.ltvCohorts.d60 },
    { label: "90d", value: f.ltvCohorts.d90 },
  ];

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
          {appmaxApproval > 0 && appmaxApproval < 80 ? (
            <Badge variant="danger">ALERTA FINANCEIRO: aprovacao de cartao abaixo de 80%</Badge>
          ) : (
            <Badge variant="success">Processamento de pagamentos em faixa estavel</Badge>
          )}
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
