"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CircleDollarSign,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Lock,
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
import { ActionableInsights } from "@/components/war-room/actionable-insights";
import { ContingencyMonitor } from "@/components/war-room/contingency-monitor";
import { CreativeFactoryBoard } from "@/components/war-room/creative-factory-board";
import { DailyBriefing } from "@/components/war-room/daily-briefing";
import { HealthCheck } from "@/components/war-room/health-check";
import { LiveAdsTable } from "@/components/war-room/live-ads-table";
import { rolePermissions, type SectionId, type UserRole } from "@/lib/auth/rbac";
import type { DemoUser } from "@/lib/auth/users";
import { computeKpis, computeMer, isFatigueImminent, safeDivide, toFiniteNumber } from "@/lib/metrics/kpis";
import type { WarRoomData } from "@/lib/war-room/types";

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
  users: DemoUser[];
  session: {
    userId: string;
    role: UserRole;
  };
};

export default function Dashboard({ data, users, session }: DashboardProps) {
  const [viewData, setViewData] = useState(data);
  const [sessionState, setSessionState] = useState(session);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);
  const initialAllowedSections = rolePermissions[session.role].allowedSections;
  const [activeSection, setActiveSection] = useState<SectionId>(
    initialAllowedSections.includes("overview") ? "overview" : initialAllowedSections[0],
  );
  const [activityLog, setActivityLog] = useState(data.activityLog);
  const [auctionInput, setAuctionInput] = useState({
    cpm: "",
    cpc: "",
    frequency: "",
    hookRate: "",
    holdRate: "",
  });
  const [backlogInput, setBacklogInput] = useState("");
  const [creativeBacklog, setCreativeBacklog] = useState<string[]>(() => {
    const legacy = data.oldSchema?.copy?.hooksBacklog ?? [];
    if (legacy.length > 0) {
      return legacy;
    }
    return [
      "Script V5 com abertura anti-objeção",
      "Ângulo de urgência com prova visual",
      "Corte 22s focado em retenção até 15s",
    ];
  });

  const permissions = rolePermissions[sessionState.role];
  const ActiveRoleIcon = permissions.icon;
  const activeUser = users.find((user) => user.id === sessionState.userId) ?? users[0];

  const intelligence = useMemo(() => {
    const rows = viewData.liveAdsTracking;
    const winners = rows.filter((row) => row.roas > 2.5).length;
    const goldHooks = rows.filter((row) => computeKpis(row).hookRate > 30).length;
    const retentionBottleneck = rows.filter((row) => computeKpis(row).holdRate < 20).length;
    const fatigue = rows.filter((row) => isFatigueImminent(row)).length;
    return { winners, goldHooks, retentionBottleneck, fatigue };
  }, [viewData.liveAdsTracking]);

  const macroRoas = useMemo(
    () => safeDivide(viewData.globalOverview.revenue, viewData.globalOverview.investment),
    [viewData.globalOverview.investment, viewData.globalOverview.revenue],
  );
  const totalTrafficSpend = useMemo(() => {
    const sourceTotal = viewData.globalOverview.trafficSources.reduce((sum, current) => sum + current.spend, 0);
    return sourceTotal > 0 ? sourceTotal : viewData.globalOverview.investment;
  }, [viewData.globalOverview.investment, viewData.globalOverview.trafficSources]);
  const mer = useMemo(() => computeMer(viewData.globalOverview.revenue, totalTrafficSpend), [totalTrafficSpend, viewData.globalOverview.revenue]);

  const updatedAtDate = new Date(viewData.updatedAt);
  const safeUpdatedAtDate = Number.isNaN(updatedAtDate.getTime()) ? new Date() : updatedAtDate;
  const updatedAt = safeUpdatedAtDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  function appendActivity(actorRole: string, actorName: string, action: string, entity: string, reason: string) {
    setActivityLog((prev) => [
      {
        id: `LOG-${Date.now()}`,
        actorRole,
        actorName,
        action,
        entity,
        reason,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
  }

  function handleAlertSquad() {
    if (!permissions.canAlertSquad) {
      return;
    }
    appendActivity(
      "Media Buyer",
      "Gestor da Midia",
      "alertou squad",
      activeSection === "googleYoutube" ? "Squad Google/YouTube" : "Squad Facebook",
      `CPA acima do KPI. Hook ${toFiniteNumber(auctionInput.hookRate)}% | Hold ${toFiniteNumber(
        auctionInput.holdRate,
      )}%`,
    );
  }

  function handleAuctionInput() {
    if (!permissions.canInputAuctionMetrics) {
      return;
    }
    appendActivity(
      "Media Buyer",
      "Gestor da Midia",
      "registrou input de leilao",
      activeSection === "googleYoutube" ? "Google/YouTube" : "Facebook",
      `CPM ${toFiniteNumber(auctionInput.cpm)} | CPC ${toFiniteNumber(auctionInput.cpc)} | Freq ${toFiniteNumber(
        auctionInput.frequency,
      )}`,
    );
  }

  function addBacklogItem() {
    if (!permissions.canManageCreativeBacklog || !backlogInput.trim()) {
      return;
    }
    setCreativeBacklog((prev) => [backlogInput.trim(), ...prev]);
    appendActivity("Copywriter", "Creative Director", "adicionou backlog", backlogInput.trim(), "nova hipótese criativa");
    setBacklogInput("");
  }

  const hiddenFinanceForRole = sessionState.role === "videoEditor";
  const isSectionAllowed = permissions.allowedSections.includes(activeSection);
  const canShowRoas = permissions.canViewRoasReal && !hiddenFinanceForRole;
  const retentionSpotlight = permissions.emphasizeRetention;

  async function switchUser(userId: string) {
    setIsSwitchingUser(true);
    try {
      const switchResponse = await fetch("/api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!switchResponse.ok) {
        throw new Error("Falha ao trocar usuario.");
      }

      const dataResponse = await fetch("/api/war-room", { cache: "no-store" });
      if (!dataResponse.ok) {
        throw new Error("Falha ao recarregar dados por perfil.");
      }

      const payload = (await dataResponse.json()) as {
        data: WarRoomData;
        session: { userId: string; role: UserRole };
      };

      const nextRole = payload.session.role;
      const nextPermissions = rolePermissions[nextRole];

      // Senior-only note: role/permission source of truth stays server-side.
      // The client only reflects already-sanitized payload from API.
      setViewData(payload.data);
      setActivityLog(payload.data.activityLog);
      setSessionState({
        userId: payload.session.userId,
        role: nextRole,
      });
      setActiveSection((prev) => (nextPermissions.allowedSections.includes(prev) ? prev : nextPermissions.allowedSections[0]));
    } finally {
      setIsSwitchingUser(false);
    }
  }

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
              const canAccessSection = permissions.allowedSections.includes(section.id);
              return (
                <Button
                  key={section.id}
                  onClick={() => (canAccessSection ? setActiveSection(section.id) : undefined)}
                  variant={isActive ? "default" : "ghost"}
                  disabled={!canAccessSection}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-cyan-300/50 bg-cyan-500/15 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                      : canAccessSection
                        ? "border-white/10 bg-white/0 hover:border-white/30 hover:bg-white/5"
                        : "cursor-not-allowed border-white/10 bg-slate-800/60 opacity-50"
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
                    {!canAccessSection && <Lock className="ml-auto h-3.5 w-3.5 text-slate-400" />}
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
              <p>{intelligence.fatigue} em possivel fadiga iminente.</p>
            </div>
          </div>
        </aside>

        <main className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:p-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Direct Response ERP</p>
              <h2 className="text-2xl font-semibold text-white">WAR ROOM OS - Multi-User & Permissions</h2>
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300">
                <ActiveRoleIcon className="h-3.5 w-3.5" />
                Perfil ativo: {permissions.label}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:max-w-[660px] md:justify-end">
              <Badge variant="sky">Fonte: {viewData.sourceLabel}</Badge>
              <Badge variant="default">Atualizado em {updatedAt}</Badge>
            </div>
          </header>

          {!isSectionAllowed && (
            <Card className="mb-5 border-rose-300/30 bg-rose-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4 text-rose-200" /> Rota protegida
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-rose-100">
                O perfil {permissions.label} nao possui acesso a esta secao.
              </CardContent>
            </Card>
          )}

          <div className="mb-5 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Switch de Usuario (RBAC)</CardTitle>
                <CardDescription>
                  Troca de sessao simulada com escopo de dados no backend para demonstracao segura.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {users.map((user) => {
                  const role = rolePermissions[user.role];
                  const Icon = role.icon;
                  const selected = user.id === sessionState.userId;
                  return (
                    <button
                      key={user.id}
                      disabled={isSwitchingUser}
                      onClick={() => void switchUser(user.id)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                        selected
                          ? "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"
                          : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {user.name}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sessao ativa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-semibold text-white">{activeUser.name}</p>
                <p className="text-slate-300">{permissions.description}</p>
                {isSwitchingUser && <p className="text-xs text-cyan-300">Atualizando escopo de dados...</p>}
              </CardContent>
            </Card>
          </div>

          {activeSection === "overview" && isSectionAllowed && (
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <CircleDollarSign className="h-4 w-4 text-cyan-300" /> Investimento (Utmify)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatCurrency(viewData.globalOverview.investment)}</p>
                  </CardContent>
                </Card>
                {!hiddenFinanceForRole && (
                  <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <BadgeDollarSign className="h-4 w-4 text-cyan-300" /> Faturamento (Utmify)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(viewData.globalOverview.revenue)}</p>
                    </CardContent>
                  </Card>
                )}
                {canShowRoas && (
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
                )}
                {canShowRoas && (
                  <Card className="border-emerald-300/30 bg-gradient-to-br from-emerald-600/20 to-slate-900">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2 text-emerald-100">
                        <TrendingUp className="h-4 w-4 text-emerald-300" /> MER / ROAS Real Ecossistema
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold text-emerald-100">{mer.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-emerald-200/80">
                        Receita bruta {formatCurrency(viewData.globalOverview.revenue)} vs gasto consolidado{" "}
                        {formatCurrency(totalTrafficSpend)}
                      </p>
                    </CardContent>
                  </Card>
                )}
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-cyan-300" /> Sync de dados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-200">{viewData.globalOverview.utmifySyncAt}</p>
                    <p className="mt-2 text-xs text-slate-400">Status de ingestao em tempo real</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gasto consolidado por fonte de trafego</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {viewData.globalOverview.trafficSources.map((source) => (
                    <div key={source.source} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
                      <p className="text-slate-300">{source.source}</p>
                      <p className="font-semibold text-white">{formatCurrency(source.spend)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

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
                      <span className="font-semibold text-white">{formatPercent(viewData.finance.approvalRate)}</span>
                    </p>
                    <p>
                      LTV consolidado: <span className="font-semibold text-white">{formatCurrency(viewData.finance.ltv)}</span>
                    </p>
                    {permissions.canViewSensitiveFinancials && (
                      <>
                        <p>
                          Faturamento liquido:{" "}
                          <span className="font-semibold text-emerald-200">{formatCurrency(viewData.finance.netRevenue)}</span>
                        </p>
                        <p>
                          Margem de lucro:{" "}
                          <span className="font-semibold text-emerald-200">{formatPercent(viewData.finance.profitMargin)}</span>
                        </p>
                      </>
                    )}
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

              {!permissions.canViewSensitiveFinancials && (
                <Card className="border-white/15 bg-slate-900/70">
                  <CardContent className="p-4 text-sm text-slate-300">
                    Dados financeiros sensiveis (faturamento liquido e margem) restritos ao perfil CEO (Admin).
                  </CardContent>
                </Card>
              )}

              {permissions.canInputAuctionMetrics && (
                <Card className="border-cyan-300/30 bg-cyan-500/10">
                  <CardHeader>
                    <CardTitle className="text-base">Input de dados brutos de leilao</CardTitle>
                    <CardDescription>CPM, CPC, frequencia, Hook Rate e Hold Rate</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <input
                      className="h-9 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm"
                      placeholder="CPM"
                      value={auctionInput.cpm}
                      onChange={(event) => setAuctionInput((prev) => ({ ...prev, cpm: event.target.value }))}
                    />
                    <input
                      className="h-9 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm"
                      placeholder="CPC"
                      value={auctionInput.cpc}
                      onChange={(event) => setAuctionInput((prev) => ({ ...prev, cpc: event.target.value }))}
                    />
                    <input
                      className="h-9 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm"
                      placeholder="Frequencia"
                      value={auctionInput.frequency}
                      onChange={(event) => setAuctionInput((prev) => ({ ...prev, frequency: event.target.value }))}
                    />
                    <input
                      className="h-9 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm"
                      placeholder="Hook Rate (%)"
                      value={auctionInput.hookRate}
                      onChange={(event) => setAuctionInput((prev) => ({ ...prev, hookRate: event.target.value }))}
                    />
                    <input
                      className="h-9 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm"
                      placeholder="Hold Rate (%)"
                      value={auctionInput.holdRate}
                      onChange={(event) => setAuctionInput((prev) => ({ ...prev, holdRate: event.target.value }))}
                    />
                    <Button variant="outline" onClick={handleAuctionInput}>
                      Registrar input
                    </Button>
                  </CardContent>
                </Card>
              )}

              {permissions.canApproveScaleCampaigns && (
                <Card className="border-emerald-300/30 bg-emerald-500/10">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="text-sm text-emerald-100">Aprovacao final de campanhas de escala disponivel para CEO.</p>
                    <Button
                      onClick={() =>
                        appendActivity("CEO", "Admin", "aprovou campanha", "Scale - Macro CBO", "ROAS e margem dentro do alvo")
                      }
                    >
                      Aprovar campanha de escala
                    </Button>
                  </CardContent>
                </Card>
              )}

              <LiveAdsTable
                title="Live Ads Tracking"
                subtitle="Hook Rate (3s/Imp) | Hold Rate (15s/3s) | VSL Efficiency (IC/LP)"
                rows={viewData.liveAdsTracking}
                hideRoasReal={!canShowRoas}
                emphasizeRetention={retentionSpotlight}
                simplified={permissions.simplifiedPerformanceView}
                showDeepDive
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <ActionableInsights rows={viewData.liveAdsTracking} role={sessionState.role} contingency={viewData.contingency} />
                <HealthCheck baselineDropRate={viewData.oldSchema?.tech?.pageLoadDropOff ?? 18} />
              </div>
              <ContingencyMonitor contingency={viewData.contingency} />
            </section>
          )}

          {activeSection === "facebook" && isSectionAllowed && (
            <section className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Squad Facebook</CardTitle>
                    <CardDescription>{viewData.squads.facebook.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">{viewData.squads.facebook.managerComment}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Creative Velocity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{viewData.squads.facebook.creativeVelocity}/semana</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Meta: {viewData.squads.facebook.creativeVelocityTarget} | Validados:{" "}
                      {viewData.squads.facebook.validatedCreatives}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Foco do dia</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">
                    {retentionSpotlight
                      ? "Destaque de retencao habilitado para orientar copy e edicao."
                      : "Iterar criativos com hold baixo e manter os hooks acima de 30% para preservar escala."}
                  </CardContent>
                </Card>
              </div>

              {permissions.canAlertSquad && (
                <Card className="border-amber-300/30 bg-amber-500/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-amber-200" /> Alertar Squad
                    </CardTitle>
                    <CardDescription>Aciona a producao quando o CPA sai do KPI</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={handleAlertSquad}>
                      Enviar alerta para Copy e Edicao
                    </Button>
                  </CardContent>
                </Card>
              )}

              <LiveAdsTable
                title="Live Ads Tracking - Squad Facebook"
                subtitle="Badges automaticas para decisao de escala ou ajuste"
                rows={viewData.liveAdsTracking}
                squadFilter="facebook"
                hideRoasReal={!canShowRoas}
                emphasizeRetention={retentionSpotlight}
                simplified={permissions.simplifiedPerformanceView}
                showDeepDive
              />
              <DailyBriefing
                items={viewData.dailyBriefing}
                squadFilter="facebook"
                allowReply={permissions.canUploadCreativeVersions || permissions.canManageCreativeBacklog}
              />
            </section>
          )}

          {activeSection === "googleYoutube" && isSectionAllowed && (
            <section className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Squad Google/YouTube</CardTitle>
                    <CardDescription>{viewData.squads.googleYoutube.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">{viewData.squads.googleYoutube.managerComment}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Creative Velocity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{viewData.squads.googleYoutube.creativeVelocity}/semana</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Meta: {viewData.squads.googleYoutube.creativeVelocityTarget} | Validados:{" "}
                      {viewData.squads.googleYoutube.validatedCreatives}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Diagnostico</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-200">
                    {retentionSpotlight
                      ? "Copywriter/Editor: priorizar curvas de retencao e VSL efficiency."
                      : "Priorizar criativos de VVC com retencao acima de 20% antes de aumentar volume."}
                  </CardContent>
                </Card>
              </div>

              {permissions.canAlertSquad && (
                <Card className="border-amber-300/30 bg-amber-500/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-amber-200" /> Alertar Squad
                    </CardTitle>
                    <CardDescription>Dispara acao de iteracao quando CPA rompe KPI</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={handleAlertSquad}>
                      Alertar Squad Google/YouTube
                    </Button>
                  </CardContent>
                </Card>
              )}

              <LiveAdsTable
                title="Live Ads Tracking - Squad Google/YouTube"
                subtitle="Search + VVC + Display com leitura de gargalos em tempo real"
                rows={viewData.liveAdsTracking}
                squadFilter="googleYoutube"
                hideRoasReal={!canShowRoas}
                emphasizeRetention={retentionSpotlight}
                simplified={permissions.simplifiedPerformanceView}
                showDeepDive
              />
              <DailyBriefing
                items={viewData.dailyBriefing}
                squadFilter="googleYoutube"
                allowReply={permissions.canUploadCreativeVersions || permissions.canManageCreativeBacklog}
              />
            </section>
          )}

          {activeSection === "factory" && isSectionAllowed && (
            <section className="space-y-5">
              <CreativeFactoryBoard tasks={viewData.creativeFactory.tasks} />
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
                        {viewData.squads.facebook.creativeVelocity}/{viewData.squads.facebook.creativeVelocityTarget}
                      </span>
                    </p>
                    <p>
                      Google/YouTube:{" "}
                      <span className="font-semibold">
                        {viewData.squads.googleYoutube.creativeVelocity}/{viewData.squads.googleYoutube.creativeVelocityTarget}
                      </span>
                    </p>
                    <p className="text-slate-400">Ganhar em DR = errar, medir e corrigir mais rapido que o mercado.</p>
                  </CardContent>
                </Card>
                {permissions.canManageCreativeBacklog && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Backlog de Criativos (Scripts e Angulos)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          className="h-9 flex-1 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm"
                          placeholder="Novo item de backlog..."
                          value={backlogInput}
                          onChange={(event) => setBacklogInput(event.target.value)}
                        />
                        <Button variant="outline" onClick={addBacklogItem}>
                          Adicionar
                        </Button>
                      </div>
                      <ul className="space-y-2 text-sm text-slate-200">
                        {creativeBacklog.slice(0, 5).map((item) => (
                          <li key={item} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
              <DailyBriefing
                items={viewData.dailyBriefing}
                allowReply={permissions.canUploadCreativeVersions || permissions.canManageCreativeBacklog}
              />
            </section>
          )}

          <section className="mt-5">
            <Card>
              <CardHeader>
                <CardTitle>Log de Atividades</CardTitle>
                <CardDescription>Accountability operacional entre squads e gestao de midia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-200">
                {activityLog.slice(0, 6).map((entry) => {
                  const line = `[${entry.actorName}] ${entry.action} [${entry.entity}] por ${entry.reason}`;
                  return (
                    <div key={entry.id} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                      <p>{line}</p>
                      <p className="text-xs text-slate-400">
                        {entry.actorRole} - {entry.timestamp}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
