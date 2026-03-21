"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Binary,
  BrainCircuit,
  ClipboardList,
  Clapperboard,
  FlaskConical,
  Handshake,
  HeartPulse,
  LayoutDashboard,
  Lock,
  MessageSquare,
  SatelliteDish,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CeoFinanceModule } from "@/components/enterprise/ceo-finance-module";
import { CommandCenterCeoView } from "@/components/enterprise/command-center-ceo-view";
import { CommandCenterModule } from "@/components/enterprise/command-center-module";
import { CopyResearchModule } from "@/components/enterprise/copy-research-module";
import { CustomerExperienceModule } from "@/components/enterprise/customer-experience-module";
import { EditorsProductionModule } from "@/components/enterprise/editors-production-module";
import { FinanceComplianceModule } from "@/components/enterprise/finance-compliance-module";
import { SalesRecoveryModule } from "@/components/enterprise/sales-recovery-module";
import { SquadSyncModule } from "@/components/enterprise/squad-sync-module";
import { TestLaboratoryModule } from "@/components/enterprise/test-laboratory-module";
import { TechCroModule } from "@/components/enterprise/tech-cro-module";
import { TrafficAttributionModule } from "@/components/enterprise/traffic-attribution-module";
import { ActionableInsights } from "@/components/war-room/actionable-insights";
import { recalculateEnterpriseFinance, WarRoomContext } from "@/context/war-room-context";
import { rolePermissions, type SectionId, type UserRole } from "@/lib/auth/rbac";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { subscribeWarRoomRealtime } from "@/lib/realtime/war-room-realtime";
import type { DemoUser } from "@/lib/auth/users";
import type { SquadSyncCommandOrder, SquadSyncKpiSnapshot, TrafficSourceKey, WarRoomData } from "@/lib/war-room/types";

type DashboardProps = {
  data: WarRoomData;
  users: DemoUser[];
  session: {
    userId: string;
    role: UserRole;
  };
};

type Section = {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

const sections: Section[] = [
  { id: "commandCenterCeo", label: "The Command Center", subtitle: "CEO View 10D", icon: LayoutDashboard },
  { id: "ceoFinance", label: "CEO & Financeiro", subtitle: "Soberania de Caixa", icon: Wallet },
  { id: "copyResearch", label: "Copy & Pesquisa", subtitle: "The Brain", icon: BrainCircuit },
  { id: "trafficAttribution", label: "Trafego & Atribuicao", subtitle: "The Engine", icon: SatelliteDish },
  { id: "testLaboratory", label: "Test Laboratory", subtitle: "Scaling Pipeline", icon: FlaskConical },
  { id: "commandCenter", label: "Command Center", subtitle: "Demandas 9D", icon: ClipboardList },
  { id: "squadSync", label: "Squad Sync", subtitle: "Hub de Demanda", icon: MessageSquare },
  { id: "editorsProduction", label: "Editores & Producao", subtitle: "The Retention", icon: Clapperboard },
  { id: "techCro", label: "Tech & CRO", subtitle: "The Frictionless Flow", icon: Binary },
  { id: "salesRecovery", label: "Sales Recovery", subtitle: "Sniper List", icon: Handshake },
  { id: "customerExperience", label: "Customer Experience", subtitle: "LTV & Churn", icon: HeartPulse },
  { id: "financeCompliance", label: "Finance & Compliance", subtitle: "DRE + Legal Vault", icon: ShieldCheck },
];

const formatHours = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Dashboard({ data, users, session }: DashboardProps) {
  const [viewData, setViewData] = useState(data);
  const [sessionState, setSessionState] = useState(session);
  const [activityLog, setActivityLog] = useState(data.activityLog);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);
  const [ceoMode, setCeoMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  const defaultSection =
    rolePermissions[session.role].allowedSections.includes("commandCenterCeo")
      ? "commandCenterCeo"
      : rolePermissions[session.role].allowedSections[0];
  const initialSection = defaultSection;
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);

  const permissions = rolePermissions[sessionState.role];
  const ActiveRoleIcon = permissions.icon;
  const activeUser = users.find((user) => user.id === sessionState.userId) ?? users[0];
  const isSectionAllowed = permissions.allowedSections.includes(activeSection);
  const canShowRoas = permissions.canViewRoasReal && sessionState.role !== "videoEditor";

  const updatedAtDate = new Date(viewData.updatedAt);
  const safeUpdatedAtDate = Number.isNaN(updatedAtDate.getTime()) ? new Date() : updatedAtDate;
  const hoursSinceUpdate = Math.max(0, (Date.now() - safeUpdatedAtDate.getTime()) / (1000 * 60 * 60));
  const syncBadgeClass =
    hoursSinceUpdate <= 12 ? "text-[#34A853]" : hoursSinceUpdate <= 24 ? "text-[#FF9900]" : "text-[#EA4335]";
  const siren = viewData.integrations.fortress.siren;
  const sirenReasons = useMemo(() => siren.reasons.join(" | "), [siren.reasons]);

  async function fetchLatestData() {
    const response = await fetch("/api/war-room", { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | {
          data: WarRoomData;
          session: { userId: string; role: UserRole };
        }
      | null;
    if (!payload) {
      return;
    }
    setViewData(payload.data);
    setActivityLog(payload.data.activityLog);
    setSessionState(payload.session);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchLatestData();
    }, WAR_ROOM_OPS_CONSTANTS.performance.dashboardRefreshMs);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      unsubscribe = await subscribeWarRoomRealtime(() => {
        void fetchLatestData();
      });
    })();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  function addActivity(actorRole: string, actorName: string, action: string, entity: string, reason: string) {
    const entry = {
      id: `LOG-${Date.now()}`,
      actorRole,
      actorName,
      action,
      entity,
      reason,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    setActivityLog((prev) => [entry, ...prev]);
    setViewData((prev) => ({ ...prev, activityLog: [entry, ...prev.activityLog] }));
  }

  function updateTrafficCpa(source: TrafficSourceKey, newValue: number) {
    setViewData((prev) => {
      const next = structuredClone(prev);
      next.enterprise.trafficAttribution.squads[source].currentCpa = Number.isFinite(newValue) ? newValue : 0;
      return recalculateEnterpriseFinance(next);
    });
  }

  function applySquadSyncFeedback(payload: {
    creativeId: string;
    kpisToday: SquadSyncKpiSnapshot;
    kpisYesterday: SquadSyncKpiSnapshot;
    sentimentNotes: string;
    commandOrders: SquadSyncCommandOrder[];
  }) {
    setViewData((prev) => {
      const next = structuredClone(prev);
      const nowIso = new Date().toISOString();
      const createdAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      next.updatedAt = nowIso;
      next.squadSync.lastReportAt = nowIso;
      next.squadSync.dailyInput = {
        creativeId: payload.creativeId,
        kpisToday: payload.kpisToday,
        kpisYesterday: payload.kpisYesterday,
        sentimentNotes: payload.sentimentNotes,
      };
      next.squadSync.commandOrders = [...payload.commandOrders, ...next.squadSync.commandOrders].slice(0, 20);
      next.squadSync.notifications = {
        ...next.squadSync.notifications,
        lastDispatchAt: createdAt,
        lastMessage:
          payload.commandOrders[0]?.title ??
          "Relatorio diario processado e ordens de comando distribuidas para os squads.",
      };

      next.enterprise.techCro.checkout.checkoutConversion = payload.kpisToday.icRate;
      next.enterprise.techCro.checkout.gatewayAlert = payload.kpisToday.icRate < 12;
      return next;
    });
  }

  function registerCreativeNaming(entry: WarRoomData["enterprise"]["copyResearch"]["namingRegistry"][number]) {
    setViewData((prev) => {
      const next = structuredClone(prev);
      const existingIndex = next.enterprise.copyResearch.namingRegistry.findIndex((item) => item.id === entry.id);
      if (existingIndex >= 0) {
        next.enterprise.copyResearch.namingRegistry[existingIndex] = entry;
      } else {
        next.enterprise.copyResearch.namingRegistry = [entry, ...next.enterprise.copyResearch.namingRegistry].slice(0, 400);
      }
      return next;
    });
  }

  async function switchUser(userId: string) {
    setIsSwitchingUser(true);
    try {
      const switchResponse = await fetch("/api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!switchResponse.ok) throw new Error("Falha ao trocar usuario.");

      const dataResponse = await fetch("/api/war-room", { cache: "no-store" });
      if (!dataResponse.ok) throw new Error("Falha ao recarregar dados.");

      const payload = (await dataResponse.json()) as {
        data: WarRoomData;
        session: { userId: string; role: UserRole };
      };

      const nextPermissions = rolePermissions[payload.session.role];
      setViewData(payload.data);
      setActivityLog(payload.data.activityLog);
      setSessionState({ userId: payload.session.userId, role: payload.session.role });
      setActiveSection((prev) => (nextPermissions.allowedSections.includes(prev) ? prev : nextPermissions.allowedSections[0]));
    } finally {
      setIsSwitchingUser(false);
    }
  }

  const contextValue = {
    data: viewData,
    updateTrafficCpa,
    addActivity,
    applySquadSyncFeedback,
    registerCreativeNaming,
  };

  return (
    <WarRoomContext.Provider value={contextValue}>
      <div className={`min-h-screen bg-[#050505] p-3 sm:p-4 md:p-6 ${siren.active ? "war-siren-active" : ""}`}>
        <div className={`mx-auto grid max-w-[1900px] gap-5 ${presentationMode ? "xl:grid-cols-[minmax(0,1fr)]" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
          {!presentationMode && (
            <aside className="rounded-2xl border border-white/10 bg-slate-900/85 p-4 backdrop-blur">
            <div className="mb-5 rounded-xl border border-[#FF9900]/40 bg-[#FF9900]/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#FFB347]">Command Center</p>
              <h1 className="text-sm font-semibold text-white">WAR ROOM OS - Enterprise 9D</h1>
            </div>

            <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const active = section.id === activeSection;
                const allowed = permissions.allowedSections.includes(section.id);
                return (
                  <Button
                    key={section.id}
                    onClick={() => allowed && setActiveSection(section.id)}
                    disabled={!allowed}
                    variant={active ? "default" : "ghost"}
                    className={`w-full justify-start rounded-xl border px-3 py-3 text-left ${
                      active
                        ? "border-[#FF9900]/50 bg-[#FF9900]/15"
                        : allowed
                          ? "border-white/10 hover:border-white/30"
                          : "cursor-not-allowed border-white/10 opacity-50"
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div>
                      <p className="text-sm">{section.label}</p>
                      <p className="text-xs text-slate-400">{section.subtitle}</p>
                    </div>
                    {!allowed && <Lock className="ml-auto h-3.5 w-3.5 text-slate-400" />}
                  </Button>
                );
              })}
            </nav>

            <div className="mt-5 rounded-xl border border-[#FF9900]/40 bg-[#FF9900]/10 p-3 text-xs">
              <p className="text-[#FFB347]">Squad Sync</p>
              <p className={syncBadgeClass}>{formatHours(hoursSinceUpdate)}h sem atualizacao completa</p>
            </div>
            </aside>
          )}

          <main className={`rounded-2xl border p-4 md:p-6 ${siren.active ? "border-rose-400/60 bg-rose-950/20" : "border-white/10 bg-slate-950/70"}`}>
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">ERP de 9 digitos</p>
                <h2 className="text-2xl font-semibold text-white">Cockpits Departamentais Unificados por Lucro Real</h2>
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300">
                  <ActiveRoleIcon className="h-3.5 w-3.5" />
                  Perfil ativo: {permissions.label}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Auto-refresh de dados estrategicos: 60s (sem F5)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setPresentationMode((prev) => {
                      const next = !prev;
                      if (next && permissions.allowedSections.includes("commandCenterCeo")) {
                        setActiveSection("commandCenterCeo");
                      }
                      return next;
                    });
                  }}
                  className={`rounded border px-2 py-1 text-xs ${
                    presentationMode ? "border-[#10B981]/50 bg-[#10B981]/20 text-[#C9FFE9]" : "border-white/20 bg-white/5 text-slate-300"
                  }`}
                >
                  {presentationMode ? "Sair do modo apresentacao" : "Modo apresentacao (TV)"}
                </button>
                {sessionState.role === "ceo" && (
                  <button
                    onClick={() => setCeoMode((prev) => !prev)}
                    className={`rounded border px-2 py-1 text-xs ${
                      ceoMode ? "border-[#10B981]/50 bg-[#10B981]/20 text-[#C9FFE9]" : "border-white/20 bg-white/5 text-slate-300"
                    }`}
                  >
                    {ceoMode ? "Modo Completo" : "Modo CEO"}
                  </button>
                )}
                {!presentationMode &&
                  users.map((user) => {
                  const selected = user.id === sessionState.userId;
                  return (
                    <button
                      key={user.id}
                      disabled={isSwitchingUser}
                      onClick={() => void switchUser(user.id)}
                      className={`rounded border px-2 py-1 text-xs ${
                        selected
                          ? "border-[#FF9900]/50 bg-[#FF9900]/20 text-[#FFD39A]"
                          : "border-white/20 bg-white/5 text-slate-300"
                      }`}
                    >
                      {user.name}
                    </button>
                  );
                })}
              </div>
            </header>

            <Card className="mb-4 border-white/10 bg-[#050505]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dashboard de Permissoes por Cargo</CardTitle>
                <CardDescription className="text-xs">
                  Visao oficial por setor: Copywriter (Vault), Midia (Scaling), Closer (Sniper List).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {permissions.allowedSections.map((sectionId) => {
                  const sectionMeta = sections.find((section) => section.id === sectionId);
                  if (!sectionMeta) return null;
                  return (
                    <Badge key={sectionId} variant="sky">
                      {sectionMeta.label}
                    </Badge>
                  );
                })}
              </CardContent>
            </Card>

            {siren.active && (
              <Card className="mb-4 border-rose-300/70 bg-rose-500/15">
                <CardContent className="p-3 text-sm text-rose-100">
                  <p className="font-semibold">SIREN SYSTEM ATIVO</p>
                  <p>{sirenReasons || "Risco critico detectado no ecossistema."}</p>
                </CardContent>
              </Card>
            )}

            {viewData.integrations.merCross.status === "critical" && (
              <Card className="mb-4 border-rose-300/40 bg-rose-500/10">
                <CardContent className="p-3 text-sm text-rose-100">
                  CRITICAL: MER global em {viewData.integrations.merCross.value.toFixed(2)}x. Escala travada para todos os setores.
                </CardContent>
              </Card>
            )}

            <Card className="mb-4 border-[#FF9900]/40 bg-[#050505]">
              <CardHeader>
                <CardTitle className="text-base">CEO Daily Briefing (IA)</CardTitle>
                <CardDescription>{viewData.integrations.fortress.executiveBriefing.generatedAt}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{viewData.integrations.fortress.executiveBriefing.summary}</p>
                <p className="text-[#FFB347]">Acao sugerida: {viewData.integrations.fortress.executiveBriefing.suggestedAction}</p>
              </CardContent>
            </Card>

            {ceoMode && sessionState.role === "ceo" && (
              <Card className="mb-4 border-[#FF9900]/40 bg-[#050505]">
                <CardHeader>
                  <CardTitle className="text-base">Modo CEO (Visao simplificada)</CardTitle>
                  <CardDescription>Investimento do dia, faturamento bruto e lucro liquido real</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Investimento do Dia</p>
                    <p className="text-2xl font-semibold text-slate-100">
                      {viewData.globalOverview.investment.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Faturamento Bruto</p>
                    <p className="text-2xl font-semibold text-slate-100">
                      {viewData.integrations.gateway.consolidatedGrossRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Lucro Liquido Real</p>
                    <p className="text-2xl font-semibold text-[#10B981]">
                      {viewData.enterprise.ceoFinance.netProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isSectionAllowed && (
              <Card className="mb-4 border-rose-300/30 bg-rose-500/10">
                <CardContent className="p-4 text-sm text-rose-100">
                  Rota protegida: o perfil {permissions.label} nao pode acessar este cockpit.
                </CardContent>
              </Card>
            )}

            {activeSection === "ceoFinance" && isSectionAllowed && (
              <CeoFinanceModule canViewSensitiveFinancials={permissions.canViewSensitiveFinancials} />
            )}
            {activeSection === "commandCenterCeo" && isSectionAllowed && (
              <CommandCenterCeoView
                data={viewData}
                presentationMode={presentationMode}
                onDrillDown={(sectionId) => setActiveSection(sectionId)}
              />
            )}
            {activeSection === "copyResearch" && isSectionAllowed && <CopyResearchModule />}
            {activeSection === "trafficAttribution" && isSectionAllowed && <TrafficAttributionModule />}
            {activeSection === "testLaboratory" && isSectionAllowed && (
              <TestLaboratoryModule actorName={activeUser.name} actorRole={sessionState.role} />
            )}
            {activeSection === "commandCenter" && isSectionAllowed && (
              <CommandCenterModule actorName={activeUser.name} actorRole={sessionState.role} />
            )}
            {activeSection === "squadSync" && isSectionAllowed && (
              <SquadSyncModule canInputDailyFeedback={permissions.canInputAuctionMetrics} actorName={activeUser.name} />
            )}
            {activeSection === "editorsProduction" && isSectionAllowed && (
              <EditorsProductionModule
                canShowRoas={canShowRoas}
                emphasizeRetention={permissions.emphasizeRetention}
                simplified={permissions.simplifiedPerformanceView}
              />
            )}
            {activeSection === "techCro" && isSectionAllowed && <TechCroModule />}
            {activeSection === "salesRecovery" && isSectionAllowed && <SalesRecoveryModule />}
            {activeSection === "customerExperience" && isSectionAllowed && <CustomerExperienceModule />}
            {activeSection === "financeCompliance" && isSectionAllowed && <FinanceComplianceModule />}

            {!presentationMode && (
              <section className="mt-5 grid gap-4 xl:grid-cols-2">
              <ActionableInsights rows={viewData.liveAdsTracking} role={sessionState.role} contingency={viewData.contingency} />
              <Card>
                <CardHeader>
                  <CardTitle>Activity Log Global</CardTitle>
                  <CardDescription>Presenca e produtividade em tempo real</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {activityLog.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                      <p>
                        [{entry.actorName}] {entry.action} [{entry.entity}] por {entry.reason}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.actorRole} - {entry.timestamp}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              </section>
            )}

            <footer className="mt-4 text-xs text-slate-500">
              Sessao: {activeUser.name} | Fundo #050505 | Alertas de vulnerabilidade em #FF9900
            </footer>
          </main>
        </div>
      </div>
    </WarRoomContext.Provider>
  );
}
