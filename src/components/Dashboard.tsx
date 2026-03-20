"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Binary, BrainCircuit, ClipboardList, Clapperboard, Lock, MessageSquare, SatelliteDish, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CeoFinanceModule } from "@/components/enterprise/ceo-finance-module";
import { CommandCenterModule } from "@/components/enterprise/command-center-module";
import { CopyResearchModule } from "@/components/enterprise/copy-research-module";
import { EditorsProductionModule } from "@/components/enterprise/editors-production-module";
import { SquadSyncModule } from "@/components/enterprise/squad-sync-module";
import { TechCroModule } from "@/components/enterprise/tech-cro-module";
import { TrafficAttributionModule } from "@/components/enterprise/traffic-attribution-module";
import { ActionableInsights } from "@/components/war-room/actionable-insights";
import { recalculateEnterpriseFinance, WarRoomContext } from "@/context/war-room-context";
import { rolePermissions, type SectionId, type UserRole } from "@/lib/auth/rbac";
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
  { id: "ceoFinance", label: "CEO & Financeiro", subtitle: "Soberania de Caixa", icon: Wallet },
  { id: "copyResearch", label: "Copy & Pesquisa", subtitle: "The Brain", icon: BrainCircuit },
  { id: "trafficAttribution", label: "Trafego & Atribuicao", subtitle: "The Engine", icon: SatelliteDish },
  { id: "commandCenter", label: "Command Center", subtitle: "Demandas 9D", icon: ClipboardList },
  { id: "squadSync", label: "Squad Sync", subtitle: "Hub de Demanda", icon: MessageSquare },
  { id: "editorsProduction", label: "Editores & Producao", subtitle: "The Retention", icon: Clapperboard },
  { id: "techCro", label: "Tech & CRO", subtitle: "The Frictionless Flow", icon: Binary },
];

const formatHours = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Dashboard({ data, users, session }: DashboardProps) {
  const [viewData, setViewData] = useState(data);
  const [sessionState, setSessionState] = useState(session);
  const [activityLog, setActivityLog] = useState(data.activityLog);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);

  const initialSection = rolePermissions[session.role].allowedSections[0];
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
  };

  return (
    <WarRoomContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#050505] p-3 sm:p-4 md:p-6">
        <div className="mx-auto grid max-w-[1700px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
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

          <main className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:p-6">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">ERP de 9 digitos</p>
                <h2 className="text-2xl font-semibold text-white">Cockpits Departamentais Unificados por Lucro Real</h2>
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300">
                  <ActiveRoleIcon className="h-3.5 w-3.5" />
                  Perfil ativo: {permissions.label}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {users.map((user) => {
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

            {viewData.integrations.merCross.status === "critical" && (
              <Card className="mb-4 border-rose-300/40 bg-rose-500/10">
                <CardContent className="p-3 text-sm text-rose-100">
                  CRITICAL: MER global em {viewData.integrations.merCross.value.toFixed(2)}x. Escala travada para todos os setores.
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
            {activeSection === "copyResearch" && isSectionAllowed && <CopyResearchModule />}
            {activeSection === "trafficAttribution" && isSectionAllowed && <TrafficAttributionModule />}
            {activeSection === "commandCenter" && isSectionAllowed && <CommandCenterModule actorName={activeUser.name} />}
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

            <footer className="mt-4 text-xs text-slate-500">
              Sessao: {activeUser.name} | Fundo #050505 | Alertas de vulnerabilidade em #FF9900
            </footer>
          </main>
        </div>
      </div>
    </WarRoomContext.Provider>
  );
}
