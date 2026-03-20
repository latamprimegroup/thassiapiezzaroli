"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";

type CeoFinanceModuleProps = {
  canViewSensitiveFinancials: boolean;
};

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function CeoFinanceModule({ canViewSensitiveFinancials }: CeoFinanceModuleProps) {
  const { data, addActivity } = useWarRoom();
  const f = data.enterprise.ceoFinance;

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
    </section>
  );
}
