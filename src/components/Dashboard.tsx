"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  CircleDollarSign,
  CreditCard,
  Gauge,
  LayoutDashboard,
  MonitorPlay,
  NotebookPen,
  Radar,
  Rocket,
  ScrollText,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type { WarRoomData } from "@/lib/war-room/types";

type DepartmentId = "ads" | "copy" | "tech" | "finance";

type Department = {
  id: DepartmentId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

const departments: Department[] = [
  {
    id: "ads",
    label: "Gestao de Trafego",
    subtitle: "Ads Control",
    icon: Radar,
  },
  {
    id: "copy",
    label: "Copywriting",
    subtitle: "Creatives & Hooks",
    icon: NotebookPen,
  },
  {
    id: "tech",
    label: "Tech & Funnel",
    subtitle: "Paginas",
    icon: MonitorPlay,
  },
  {
    id: "finance",
    label: "Financeiro",
    subtitle: "Net Profit",
    icon: Wallet,
  },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function statusStyles(hookRate: number) {
  if (hookRate < 20) {
    return "bg-red-500/15 text-red-200 border border-red-400/40";
  }
  return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30";
}

type DashboardProps = {
  data: WarRoomData;
};

export default function Dashboard({ data }: DashboardProps) {
  const [activeDepartment, setActiveDepartment] = useState<DepartmentId>("ads");
  const creatives = data.ads.creatives;

  const adsMetrics = useMemo(() => {
    const investmentTotal = data.ads.investmentTotal;
    const avgRoas = data.ads.avgRoas;
    const avgCpm = data.ads.avgCpm;
    const criticalHooks = creatives.filter((creative) => creative.hookRate < 20).length;
    const winners = creatives.filter((creative) => creative.roas > 2.2).length;

    return { investmentTotal, avgRoas, avgCpm, criticalHooks, winners };
  }, [data.ads.avgCpm, data.ads.avgRoas, data.ads.investmentTotal, creatives]);

  const updatedAtDate = new Date(data.updatedAt);
  const safeUpdatedAtDate = Number.isNaN(updatedAtDate.getTime()) ? new Date() : updatedAtDate;
  const updatedAt = safeUpdatedAtDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 backdrop-blur">
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
            <LayoutDashboard className="h-6 w-6 text-cyan-300" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Nova Central</p>
              <h1 className="text-sm font-semibold text-white">WAR ROOM DASHBOARD</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {departments.map((department) => {
              const Icon = department.icon;
              const isActive = department.id === activeDepartment;
              return (
                <button
                  key={department.id}
                  onClick={() => setActiveDepartment(department.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-cyan-300/50 bg-cyan-500/15 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                      : "border-white/10 bg-white/0 hover:border-white/30 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? "text-cyan-200" : "text-slate-300"}`} />
                    <div>
                      <p className={`text-sm font-medium ${isActive ? "text-white" : "text-slate-100"}`}>
                        {department.label}
                      </p>
                      <p className="text-xs text-slate-400">{department.subtitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Inteligencia</p>
            <p className="mt-1 text-sm text-amber-100">
              {adsMetrics.winners} criativos com badge <span className="font-semibold">Winner</span> e{" "}
              {adsMetrics.criticalHooks} em alerta vermelho.
            </p>
          </div>
        </aside>

        <main className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:p-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Central de Comando</p>
              <h2 className="text-2xl font-semibold text-white">Painel Executivo Multidepartamental</h2>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              Atualizado em {updatedAt}
            </div>
          </header>
          <div className="mb-6 inline-flex rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
            Fonte de dados: {data.sourceLabel}
          </div>

          {activeDepartment === "ads" && (
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-300">
                    <CircleDollarSign className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm">Investimento Total</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">{formatCurrency(adsMetrics.investmentTotal)}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-300">
                    <Rocket className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm">ROAS Medio</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">
                    {adsMetrics.avgRoas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-300">
                    <Gauge className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm">CPM Medio</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">{formatCurrency(adsMetrics.avgCpm)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                <h3 className="mb-4 text-lg font-semibold text-white">Performance de Criativos</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-slate-400">
                        <th className="px-3 py-2 font-medium">ID_Criativo</th>
                        <th className="px-3 py-2 font-medium">Hook Rate (%)</th>
                        <th className="px-3 py-2 font-medium">Hold Rate (%)</th>
                        <th className="px-3 py-2 font-medium">Veredito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creatives.map((creative) => (
                        <tr key={creative.id} className="border-b border-white/5 text-slate-200">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{creative.id}</span>
                              {creative.roas > 2.2 && (
                                <span className="rounded-full border border-amber-300/40 bg-amber-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                                  Winner
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${statusStyles(
                                creative.hookRate,
                              )}`}
                            >
                              {creative.hookRate < 20 && <ShieldAlert className="h-3.5 w-3.5" />}
                              {formatPercent(creative.hookRate)}
                            </span>
                          </td>
                          <td className="px-3 py-3">{formatPercent(creative.holdRate)}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium ${
                                creative.verdict === "Escalar"
                                  ? "bg-emerald-500/20 text-emerald-200"
                                  : "bg-rose-500/20 text-rose-200"
                              }`}
                            >
                              {creative.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeDepartment === "copy" && (
            <section className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <h3 className="mb-3 text-lg font-semibold text-white">Central de Angulos</h3>
                  <ul className="space-y-2">
                    {data.copy.angles.map((angle) => (
                      <li key={angle} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                        {angle}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <h3 className="mb-3 text-lg font-semibold text-white">Backlog de Ganchos para Gravar</h3>
                  <ul className="space-y-2">
                    {data.copy.hooksBacklog.map((hook) => (
                      <li key={hook} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                        {hook}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-indigo-300/30 bg-indigo-500/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-indigo-200" />
                    <h4 className="font-semibold text-indigo-100">Roteirizando</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-indigo-100/90">
                    {data.copy.productionFlow.roteirizando.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-200" />
                    <h4 className="font-semibold text-cyan-100">Gravando</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-cyan-100/90">
                    {data.copy.productionFlow.gravando.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <MonitorPlay className="h-4 w-4 text-emerald-200" />
                    <h4 className="font-semibold text-emerald-100">Editando</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-emerald-100/90">
                    {data.copy.productionFlow.editando.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {activeDepartment === "tech" && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-300">
                  <Gauge className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm">Page Load (Drop-off)</span>
                </div>
                <p className="text-3xl font-semibold text-white">{formatPercent(data.tech.pageLoadDropOff)}</p>
                <p className="mt-2 text-sm text-slate-400">{data.tech.pageLoadNote}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-300">
                  <MonitorPlay className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm">Retencao da VSL</span>
                </div>
                <p className="text-3xl font-semibold text-white">{formatPercent(data.tech.vslRetention)}</p>
                <p className="mt-2 text-sm text-slate-400">{data.tech.vslNote}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-300">
                  <BadgeDollarSign className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm">Conversao de Checkout</span>
                </div>
                <p className="text-3xl font-semibold text-white">{formatPercent(data.tech.checkoutConversion)}</p>
                <p className="mt-2 text-sm text-slate-400">{data.tech.checkoutNote}</p>
              </div>
            </section>
          )}

          {activeDepartment === "finance" && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-emerald-200">
                  <CircleDollarSign className="h-4 w-4" />
                  <span className="text-sm">Faturamento Real</span>
                </div>
                <p className="text-3xl font-semibold text-white">{formatCurrency(data.finance.revenue)}</p>
              </div>

              <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-sky-200">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">Aprovacao Cartao/PIX</span>
                </div>
                <p className="text-3xl font-semibold text-white">{formatPercent(data.finance.approvalRate)}</p>
              </div>

              <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-violet-200">
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm">LTV</span>
                </div>
                <p className="text-3xl font-semibold text-white">{formatCurrency(data.finance.ltv)}</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
