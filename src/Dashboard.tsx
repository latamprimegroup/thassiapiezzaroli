import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BadgeDollarSign,
  CircleDollarSign,
  Clapperboard,
  GaugeCircle,
  HandCoins,
  Layers3,
  LoaderCircle,
  Megaphone,
  MonitorUp,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

type DepartmentKey = "ads" | "copy" | "tech" | "finance";

type Creative = {
  id: string;
  hookRate: number;
  holdRate: number;
  roas: number;
  spend: number;
};

const departments: Array<{
  key: DepartmentKey;
  label: string;
  icon: typeof Megaphone;
}> = [
  { key: "ads", label: "Gestão de Tráfego", icon: Megaphone },
  { key: "copy", label: "Copywriting", icon: Clapperboard },
  { key: "tech", label: "Tech & Funnel", icon: MonitorUp },
  { key: "finance", label: "Financeiro", icon: CircleDollarSign },
];

const creatives: Creative[] = [
  { id: "CR-184", hookRate: 34, holdRate: 24, roas: 2.61, spend: 14500 },
  { id: "CR-219", hookRate: 18, holdRate: 14, roas: 1.09, spend: 7600 },
  { id: "CR-220", hookRate: 27, holdRate: 22, roas: 2.31, spend: 12100 },
  { id: "CR-228", hookRate: 12, holdRate: 10, roas: 0.71, spend: 3900 },
  { id: "CR-233", hookRate: 29, holdRate: 26, roas: 2.88, spend: 19100 },
];

const backlogHooks = [
  "“O erro de 7 segundos que derruba seu ROAS sem você perceber”",
  "“Eu testei 11 criativos em 72h: este formato venceu todos”",
  "“Seu checkout parece bonito, mas está vazando dinheiro aqui”",
  "“Como dobramos o LTV com uma mudança simples de oferta”",
];

const angles = [
  "Autoridade técnica + prova social",
  "Comparativo antes/depois + urgência",
  "Mecanismo único + quebra de objeção",
  "Storytelling do fundador + números reais",
];

const productionStatus = [
  { status: "Roteirizando", qty: 6, icon: Layers3 },
  { status: "Gravando", qty: 4, icon: Activity },
  { status: "Editando", qty: 3, icon: LoaderCircle },
];

const pageMetrics = [
  { label: "Page Load (Drop-off)", value: "31,8%", trend: "Melhorou 4,2%" },
  { label: "Retenção da VSL", value: "42,4%", trend: "Estável na semana" },
  { label: "Conversão de Checkout", value: "7,6%", trend: "Subiu 1,1%" },
];

const financialMetrics = [
  { label: "Faturamento Real", value: "R$ 1.284.300", icon: BadgeDollarSign },
  { label: "Aprovação Cartão/PIX", value: "87,2%", icon: ShieldCheck },
  { label: "LTV Médio", value: "R$ 1.940", icon: HandCoins },
];

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const percent = (value: number) => `${value.toFixed(1)}%`;

const verdict = (creative: Creative) => {
  if (creative.roas > 2.2 && creative.hookRate >= 20) return "Escalar";
  return "Matar";
};

const getHealthScore = (creative: Creative) => {
  const hookWeight = creative.hookRate * 0.45;
  const holdWeight = creative.holdRate * 0.35;
  const roasWeight = Math.min(creative.roas, 3) * 11;
  return Math.min(100, Math.round(hookWeight + holdWeight + roasWeight));
};

function Dashboard() {
  const [activeDepartment, setActiveDepartment] = useState<DepartmentKey>("ads");

  const stats = useMemo(() => {
    const totalSpend = creatives.reduce((sum, item) => sum + item.spend, 0);
    const avgRoas = creatives.reduce((sum, item) => sum + item.roas, 0) / creatives.length;
    const avgCpm = 43.7;
    return { totalSpend, avgRoas, avgCpm };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-950/70 p-6 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-300">
              <GaugeCircle size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Central IA</p>
              <h1 className="text-lg font-semibold">War Room Dashboard</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {departments.map((department) => {
              const Icon = department.icon;
              const isActive = activeDepartment === department.key;
              return (
                <button
                  key={department.key}
                  onClick={() => setActiveDepartment(department.key)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  <span>{department.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-6 p-6 md:p-8">
          <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 p-6">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Nova Central de Inteligência</p>
            <h2 className="text-2xl font-semibold md:text-3xl">Visão executiva em tempo real</h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Painel de comando com foco em mídia, criativos, funil e lucro líquido para decisões rápidas de escala.
            </p>
          </header>

          {activeDepartment === "ads" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard title="Investimento Total" value={money(stats.totalSpend)} icon={TrendingUp} />
                <MetricCard title="ROAS Médio" value={stats.avgRoas.toFixed(2)} icon={Target} />
                <MetricCard title="CPM Médio" value={money(stats.avgCpm)} icon={BarChart3} />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="text-amber-300" size={18} />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                    Performance de Criativos
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-3 py-2">ID_Criativo</th>
                        <th className="px-3 py-2">Hook Rate (%)</th>
                        <th className="px-3 py-2">Hold Rate (%)</th>
                        <th className="px-3 py-2">Health Score</th>
                        <th className="px-3 py-2">Veredito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creatives.map((creative) => {
                        const health = getHealthScore(creative);
                        const lowHook = creative.hookRate < 20;
                        const winner = creative.roas > 2.2;
                        return (
                          <tr key={creative.id} className="border-t border-slate-800">
                            <td className="px-3 py-3 font-medium text-slate-100">{creative.id}</td>
                            <td className={`px-3 py-3 ${lowHook ? "text-rose-300" : "text-slate-200"}`}>
                              {percent(creative.hookRate)}
                            </td>
                            <td className="px-3 py-3 text-slate-200">{percent(creative.holdRate)}</td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                  lowHook ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {health}
                                {lowHook ? " - Alerta Vermelho" : ""}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                    verdict(creative) === "Escalar"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-slate-700 text-slate-200"
                                  }`}
                                >
                                  {verdict(creative)}
                                </span>
                                {winner && (
                                  <span className="rounded-lg bg-amber-300/20 px-2 py-1 text-xs font-semibold text-amber-300">
                                    Winner
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeDepartment === "copy" && (
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Central de Ângulos">
                <ul className="space-y-3">
                  {angles.map((angle) => (
                    <li key={angle} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                      {angle}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Backlog de Ganchos para Gravar">
                <ul className="space-y-3">
                  {backlogHooks.map((hook) => (
                    <li key={hook} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                      {hook}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Status de Produção">
                <div className="grid gap-3 md:grid-cols-3">
                  {productionStatus.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.status} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                        <div className="mb-2 text-slate-300">
                          <Icon size={18} />
                        </div>
                        <p className="text-xs uppercase tracking-wider text-slate-400">{item.status}</p>
                        <p className="text-2xl font-semibold">{item.qty}</p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}

          {activeDepartment === "tech" && (
            <div className="grid gap-4 md:grid-cols-3">
              {pageMetrics.map((metric) => (
                <MetricCard key={metric.label} title={metric.label} value={metric.value} helper={metric.trend} icon={Zap} />
              ))}
            </div>
          )}

          {activeDepartment === "finance" && (
            <div className="grid gap-4 md:grid-cols-3">
              {financialMetrics.map((metric) => (
                <MetricCard key={metric.label} title={metric.label} value={metric.value} icon={metric.icon} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  helper,
}: {
  title: string;
  value: string;
  icon: typeof TrendingUp;
  helper?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4 inline-flex rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
        <Icon size={18} />
      </div>
      <p className="text-xs uppercase tracking-wider text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {helper && <p className="mt-1 text-xs text-emerald-300">{helper}</p>}
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-200">{title}</h3>
      {children}
    </section>
  );
}

export default Dashboard;
