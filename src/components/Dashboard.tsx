"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  CircleDollarSign,
  CreditCard,
  Gauge,
  LayoutDashboard,
  MessageSquareText,
  MonitorPlay,
  Radar,
  Rocket,
  ScrollText,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreativeFactoryBoard } from "@/components/war-room/creative-factory-board";
import { DailyBriefing } from "@/components/war-room/daily-briefing";
import { LiveAdsTable } from "@/components/war-room/live-ads-table";
import type { WarRoomData } from "@/lib/war-room/types";

type SectionId = "overview" | "facebook" | "googleYoutube" | "factory";

type Section = {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

const sections: Section[] = [
  {
    id: "overview",
    label: "Global Overview",
    subtitle: "Investimento vs Faturamento",
    icon: LayoutDashboard,
  },
  {
    id: "facebook",
    label: "Squad Facebook",
    subtitle: "FB Ads",
    icon: Radar,
  },
  {
    id: "googleYoutube",
    label: "Squad Google/YouTube",
    subtitle: "Search / VVC / Display",
    icon: MonitorPlay,
  },
  {
    id: "factory",
    label: "Creative Factory",
    subtitle: "Kanban de producao",
    icon: ScrollText,
  },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type DashboardProps = {
  data: WarRoomData;
};

export default function Dashboard({ data }: DashboardProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  const intelligence = useMemo(() => {
    const rows = data.liveAdsTracking;
    const winners = rows.filter((row) => row.roas > 2.5).length;
    const goldHooks = rows.filter((row) => row.impressions > 0 && (row.views3s / row.impressions) * 100 > 30).length;
    const retentionBottleneck = rows.filter((row) => row.views3s > 0 && (row.views15s / row.views3s) * 100 < 20).length;
    return { winners, goldHooks, retentionBottleneck };
  }, [data.liveAdsTracking]);

  const macroRoas = useMemo(() => {
    if (data.globalOverview.investment <= 0) {
      return 0;
    }
    return data.globalOverview.revenue / data.globalOverview.investment;
  }, [data.globalOverview.investment, data.globalOverview.revenue]);

  const updatedAtDate = new Date(data.updatedAt);
  const safeUpdatedAtDate = Number.isNaN(updatedAtDate.getTime()) ? new Date() : updatedAtDate;
  const updatedAt = safeUpdatedAtDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-slate-900/85 p-4 backdrop-blur">
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
            <LayoutDashboard className="h-6 w-6 text-cyan-300" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">8-Figure Squad Engine</p>
              <h1 className="text-sm font-semibold text-white">WAR ROOM OS</h1>
            </div>
          </div>

          <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <Button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  variant={isActive ? "default" : "ghost"}
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
                        {section.label}
                      </p>
                      <p className="text-xs text-slate-400">{section.subtitle}</p>
                    </div>
                  </div>
                </Button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Inteligencia</p>
            <div className="mt-2 space-y-1 text-sm text-amber-100">
              <p>{intelligence.goldHooks} criativos com badge Gancho de Ouro.</p>
              <p>{intelligence.retentionBottleneck} gargalos de retencao identificados.</p>
              <p>{intelligence.winners} anuncios com WINNER DETECTED.</p>
            </div>
          </div>
        </aside>

        <main className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:p-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Direct Response ERP</p>
              <h2 className="text-2xl font-semibold text-white">WAR ROOM OS - Squads + Dados + Producao</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="sky">Fonte: {data.sourceLabel}</Badge>
              <Badge variant="default">Atualizado em {updatedAt}</Badge>
            </div>
          </header>

          {activeSection === "overview" && (
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <CircleDollarSign className="h-4 w-4 text-cyan-300" /> Investimento (Utmify)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatCurrency(data.globalOverview.investment)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <BadgeDollarSign className="h-4 w-4 text-cyan-300" /> Faturamento (Utmify)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatCurrency(data.globalOverview.revenue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-cyan-300" /> ROAS Macro
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{macroRoas.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-cyan-300" /> Sync de dados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-200">{data.globalOverview.utmifySyncAt}</p>
                    <p className="mt-2 text-xs text-slate-400">Status de ingestao em tempo real</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gauge className="h-4 w-4 text-cyan-300" /> Saude operacional
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-200">
                    <p>
                      Taxa de aprovacao de pagamento:{" "}
                      <span className="font-semibold text-white">{formatPercent(data.finance.approvalRate)}</span>
                    </p>
                    <p>
                      LTV consolidado: <span className="font-semibold text-white">{formatCurrency(data.finance.ltv)}</span>
                    </p>
                    <p className="text-slate-400">
                      Objetivo: manter velocity acima da meta em cada squad para acelerar iteracao em DR.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="h-4 w-4 text-amber-300" /> Highlights automaticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-200">
                    <p>
                      <span className="font-semibold text-amber-200">{intelligence.goldHooks}</span> anuncios com Hook
                      acima de 30%.
                    </p>
                    <p>
                      <span className="font-semibold text-rose-200">{intelligence.retentionBottleneck}</span> anuncios em
                      gargalo de retencao.
                    </p>
                    <p>
                      <span className="font-semibold text-emerald-200">{intelligence.winners}</span> com ROAS acima de 2.5.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <LiveAdsTable
                title="Live Ads Tracking"
                subtitle="Hook Rate (3s/Imp) | Hold Rate (15s/3s) | VSL Efficiency (IC/LP)"
                rows={data.liveAdsTracking}
              />
            </section>
          )}

          {activeSection === "facebook" && (
            <section className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Squad Facebook</CardTitle>
                    <CardDescription>{data.squads.facebook.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">{data.squads.facebook.managerComment}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Creative Velocity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{data.squads.facebook.creativeVelocity}/semana</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Meta: {data.squads.facebook.creativeVelocityTarget} | Validados:{" "}
                      {data.squads.facebook.validatedCreatives}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Foco do dia</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">
                    Iterar criativos com hold baixo e manter os hooks acima de 30% para preservar escala.
                  </CardContent>
                </Card>
              </div>

              <LiveAdsTable
                title="Live Ads Tracking - Squad Facebook"
                subtitle="Badges automaticas para decisao de escala ou ajuste"
                rows={data.liveAdsTracking}
                squadFilter="facebook"
              />
              <DailyBriefing items={data.dailyBriefing} squadFilter="facebook" />
            </section>
          )}

          {activeSection === "googleYoutube" && (
            <section className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Squad Google/YouTube</CardTitle>
                    <CardDescription>{data.squads.googleYoutube.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">{data.squads.googleYoutube.managerComment}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Creative Velocity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{data.squads.googleYoutube.creativeVelocity}/semana</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Meta: {data.squads.googleYoutube.creativeVelocityTarget} | Validados:{" "}
                      {data.squads.googleYoutube.validatedCreatives}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Diagnostico</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">
                    Priorizar criativos de VVC com retencao acima de 20% antes de aumentar volume.
                  </CardContent>
                </Card>
              </div>

              <LiveAdsTable
                title="Live Ads Tracking - Squad Google/YouTube"
                subtitle="Search + VVC + Display com leitura de gargalos em tempo real"
                rows={data.liveAdsTracking}
                squadFilter="googleYoutube"
              />
              <DailyBriefing items={data.dailyBriefing} squadFilter="googleYoutube" />
            </section>
          )}

          {activeSection === "factory" && (
            <section className="space-y-5">
              <CreativeFactoryBoard tasks={data.creativeFactory.tasks} />
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquareText className="h-4 w-4 text-cyan-300" />
                      Daily Briefing Integrado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">
                    O gestor de trafego abre o contexto tecnico e o time responde no mesmo fluxo com link de versao
                    (V2, V3, V4), reduzindo ruído de WhatsApp e acelerando ciclos de correcao.
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="h-4 w-4 text-cyan-300" />
                      Indicadores de velocidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-slate-200">
                    <p>
                      Facebook:{" "}
                      <span className="font-semibold">
                        {data.squads.facebook.creativeVelocity}/{data.squads.facebook.creativeVelocityTarget}
                      </span>
                    </p>
                    <p>
                      Google/YouTube:{" "}
                      <span className="font-semibold">
                        {data.squads.googleYoutube.creativeVelocity}/{data.squads.googleYoutube.creativeVelocityTarget}
                      </span>
                    </p>
                    <p className="text-slate-400">Ganhar em DR = errar, medir e corrigir mais rapido que o mercado.</p>
                  </CardContent>
                </Card>
              </div>
              <DailyBriefing items={data.dailyBriefing} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
