"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { HealthCheck } from "@/components/war-room/health-check";
import { useWarRoom } from "@/context/war-room-context";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { computeIntelligenceEngine, ELITE_BENCHMARKS } from "@/lib/metrics/intelligence-engine";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

type OpsObservabilitySnapshot = {
  generatedAt: string;
  queue: {
    depth: number;
    failedJobs: number;
    processedToday: number;
    deadLetterEvents: number;
    estimatedDrainMinutes: number;
  };
  reliability: {
    errorRatePct: number;
    estimatedMttrMinutes: number;
  };
  slos: Array<{
    id: "queueDrain" | "errorRate" | "mttr";
    label: string;
    target: string;
    current: string;
    status: "pass" | "warning" | "breach";
    note: string;
  }>;
  incidentCenter: {
    openCount: number;
    resolvedCount: number;
    breachedOpenCount: number;
    mttrBySquad: Array<{
      squad: "techCro" | "trafficMedia" | "copyResearch" | "ceoFinance" | "platform";
      incidents: number;
      mttrMinutes: number;
    }>;
    recent: Array<{
      id: string;
      squad: "techCro" | "trafficMedia" | "copyResearch" | "ceoFinance" | "platform";
      severity: "warning" | "critical";
      status: "open" | "resolved";
      title: string;
      description: string;
      startedAt: string;
      resolvedAt: string;
      slaTargetMinutes: number;
      slaBreached: boolean;
      resolutionMinutes: number;
    }>;
  };
  overallStatus: "pass" | "warning" | "breach";
};

type GoLiveSnapshot = {
  generatedAt: string;
  environment: string;
  goNoGo: boolean;
  checks: Array<{
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  blockingFailures: string[];
};

export function TechCroModule() {
  const { data } = useWarRoom();
  const tech = data.enterprise.techCro;
  const intelligence = computeIntelligenceEngine(data);
  const apiStatus = data.integrations.apiStatus;
  const fortress = data.integrations.fortress;
  const killSwitch = data.integrations.operations.killSwitch;
  const audioGuardRef = useRef<string>("");
  const [opsObservability, setOpsObservability] = useState<OpsObservabilitySnapshot | null>(null);
  const [goLiveSnapshot, setGoLiveSnapshot] = useState<GoLiveSnapshot | null>(null);
  const [routingRules, setRoutingRules] = useState<
    Array<{
      id: string;
      offerId: string;
      primaryUrl: string;
      backupUrls: string[];
      activeUrl: string;
      mode: "primary" | "failover_manual" | "failover_auto";
      reason: string;
      lastSwitchAt: string;
    }>
  >([]);

  useEffect(() => {
    const shouldAlert = tech.lcpSeconds > 1.5 || intelligence.gatewayHealth.alert || fortress.siren.active;
    if (!shouldAlert) {
      audioGuardRef.current = "";
      return;
    }
    const guardKey = `${tech.lcpSeconds.toFixed(2)}-${intelligence.gatewayHealth.currentApproval.toFixed(2)}-${fortress.siren.active ? "1" : "0"}`;
    if (audioGuardRef.current === guardKey) {
      return;
    }
    audioGuardRef.current = guardKey;
    const AudioContextImpl =
      typeof window !== "undefined" ? window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
    if (!AudioContextImpl) {
      return;
    }
    const context = new AudioContextImpl();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 760;
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.onended = () => {
      void context.close();
    };
  }, [fortress.siren.active, intelligence.gatewayHealth.alert, intelligence.gatewayHealth.currentApproval, tech.lcpSeconds]);

  useEffect(() => {
    let active = true;
    async function loadObservability() {
      const response = await fetch("/api/ops/observability", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as { snapshot?: OpsObservabilitySnapshot } | null;
      if (!payload?.snapshot || !active) {
        return;
      }
      setOpsObservability(payload.snapshot);
    }
    void loadObservability();
    const timer = window.setInterval(loadObservability, WAR_ROOM_OPS_CONSTANTS.performance.dashboardRefreshMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadGoLiveReadiness() {
      const response = await fetch("/api/ops/go-live", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as { snapshot?: GoLiveSnapshot } | null;
      if (!payload?.snapshot || !active) {
        return;
      }
      setGoLiveSnapshot(payload.snapshot);
    }
    void loadGoLiveReadiness();
    const timer = window.setInterval(loadGoLiveReadiness, WAR_ROOM_OPS_CONSTANTS.performance.dashboardRefreshMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRouting() {
      const response = await fetch("/api/routing/switch", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | {
            rules?: Array<{
              id: string;
              offerId: string;
              primaryUrl: string;
              backupUrls: string[];
              activeUrl: string;
              mode: "primary" | "failover_manual" | "failover_auto";
              reason: string;
              lastSwitchAt: string;
            }>;
          }
        | null;
      if (!payload?.rules || !active) {
        return;
      }
      setRoutingRules(payload.rules);
    }
    void loadRouting();
    const timer = window.setInterval(() => {
      void loadRouting();
    }, WAR_ROOM_OPS_CONSTANTS.performance.dashboardRefreshMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function forceRoutingFailover() {
    const globalRoute = routingRules.find((rule) => rule.offerId === "global") ?? routingRules[0];
    if (!globalRoute) {
      return;
    }
    const nextTarget = globalRoute.backupUrls.find((url) => url !== globalRoute.activeUrl) ?? globalRoute.backupUrls[0];
    if (!nextTarget) {
      return;
    }
    const response = await fetch("/api/routing/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: globalRoute.offerId,
        targetUrl: nextTarget,
        mode: "failover_manual",
        reason: "failover manual acionado pelo Tech/CRO.",
      }),
    }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const refresh = await fetch("/api/routing/switch", { cache: "no-store" }).catch(() => null);
    if (!refresh?.ok) {
      return;
    }
    const payload = (await refresh.json().catch(() => null)) as { rules?: typeof routingRules } | null;
    if (payload?.rules) {
      setRoutingRules(payload.rules);
    }
  }

  function renderProviderStatus(
    label: string,
    status: "online" | "syncing" | "error",
    trend12h: number[],
    lastSync: string,
    errorMessage: string,
  ) {
    const variant = status === "online" ? "success" : status === "syncing" ? "warning" : "danger";
    const statusLabel = status === "online" ? "ONLINE" : status === "syncing" ? "SYNCING" : "ERROR";
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-slate-200">{label}</p>
          <Badge variant={variant}>{statusLabel}</Badge>
        </div>
        <Sparkline values={trend12h} className="h-7 w-24" strokeClassName={status === "error" ? "stroke-[#EA4335]" : "stroke-[#10B981]"} />
        <p className="mt-1 text-[11px] text-slate-400">Ultimo sync: {lastSync}</p>
        {errorMessage ? <p className="text-[11px] text-rose-300">{errorMessage}</p> : null}
      </div>
    );
  }

  function renderSloStatus(status: "pass" | "warning" | "breach") {
    if (status === "pass") {
      return <Badge variant="success">PASS</Badge>;
    }
    if (status === "warning") {
      return <Badge variant="warning">WARNING</Badge>;
    }
    return <Badge variant="danger">BREACH</Badge>;
  }

  async function resolveIncident(incidentId: string) {
    const response = await fetch("/api/ops/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId, note: "Resolvido via painel Tech/CRO." }),
    }).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const refresh = await fetch("/api/ops/observability", { cache: "no-store" }).catch(() => null);
    if (!refresh?.ok) {
      return;
    }
    const payload = (await refresh.json().catch(() => null)) as { snapshot?: OpsObservabilitySnapshot } | null;
    if (payload?.snapshot) {
      setOpsObservability(payload.snapshot);
    }
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status APIs (Gateway & Attribution)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {renderProviderStatus(
            "Utmify",
            apiStatus.utmify.status,
            apiStatus.utmify.trend12h,
            apiStatus.utmify.lastSync,
            apiStatus.utmify.errorMessage,
          )}
          {renderProviderStatus(
            "Appmax",
            apiStatus.appmax.status,
            apiStatus.appmax.trend12h,
            apiStatus.appmax.lastSync,
            apiStatus.appmax.errorMessage,
          )}
          {renderProviderStatus(
            "Kiwify",
            apiStatus.kiwify.status,
            apiStatus.kiwify.trend12h,
            apiStatus.kiwify.lastSync,
            apiStatus.kiwify.errorMessage,
          )}
          {renderProviderStatus(
            "Yampi",
            apiStatus.yampi.status,
            apiStatus.yampi.trend12h,
            apiStatus.yampi.lastSync,
            apiStatus.yampi.errorMessage,
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observability Command (SLO/MTTR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!opsObservability ? (
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              Carregando snapshot de observabilidade...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                <p className="text-slate-300">
                  Queue {opsObservability.queue.depth} | Failed {opsObservability.queue.failedJobs} | DLQ{" "}
                  {opsObservability.queue.deadLetterEvents}
                </p>
                {renderSloStatus(opsObservability.overallStatus)}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {opsObservability.slos.map((slo) => (
                  <div key={slo.id} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-slate-200">{slo.label}</p>
                      {renderSloStatus(slo.status)}
                    </div>
                    <p className="text-slate-400">Target: {slo.target}</p>
                    <p className="text-slate-300">Atual: {slo.current}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{slo.note}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                <p className="text-slate-300">
                  Incidentes abertos: {opsObservability.incidentCenter.openCount} | Resolvidos:{" "}
                  {opsObservability.incidentCenter.resolvedCount} | SLA breached:{" "}
                  {opsObservability.incidentCenter.breachedOpenCount}
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Snapshot: {new Date(opsObservability.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Go-Live Readiness (Hardening)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {!goLiveSnapshot ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Carregando readiness de producao...</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-300">Ambiente: {goLiveSnapshot.environment}</p>
                <Badge variant={goLiveSnapshot.goNoGo ? "success" : "danger"}>
                  {goLiveSnapshot.goNoGo ? "GO" : "NO-GO"}
                </Badge>
              </div>
              {goLiveSnapshot.checks.map((check) => (
                <div key={check.id} className="rounded border border-white/10 bg-black/30 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-slate-200">{check.label}</p>
                    <Badge
                      variant={
                        check.status === "pass"
                          ? "success"
                          : check.status === "warn"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {check.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-slate-400">{check.detail}</p>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incident Center (Historico + MTTR por Squad)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!opsObservability ? (
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              Carregando incident center...
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-5">
                {opsObservability.incidentCenter.mttrBySquad.map((row) => (
                  <div key={row.squad} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                    <p className="text-slate-300">{row.squad}</p>
                    <p className="text-slate-100">{row.mttrMinutes.toFixed(1)} min MTTR</p>
                    <p className="text-[11px] text-slate-500">{row.incidents} resolvidos</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {opsObservability.incidentCenter.recent.length === 0 ? (
                  <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-slate-400">
                    Sem incidentes registrados no periodo.
                  </div>
                ) : (
                  opsObservability.incidentCenter.recent.slice(0, 10).map((incident) => (
                    <div key={incident.id} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-slate-100">{incident.title}</p>
                        <div className="flex items-center gap-1">
                          <Badge variant={incident.severity === "critical" ? "danger" : "warning"}>
                            {incident.severity.toUpperCase()}
                          </Badge>
                          <Badge variant={incident.status === "open" ? "sky" : "success"}>
                            {incident.status.toUpperCase()}
                          </Badge>
                          {incident.slaBreached && <Badge variant="danger">SLA BREACHED</Badge>}
                        </div>
                      </div>
                      <p className="text-slate-300">{incident.description}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Squad: {incident.squad} | Inicio:{" "}
                        {new Date(incident.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {incident.resolvedAt
                          ? ` | Resolvido em ${incident.resolutionMinutes} min`
                          : ` | SLA alvo ${incident.slaTargetMinutes} min`}
                      </p>
                      {incident.status === "open" && (
                        <button
                          onClick={() => void resolveIncident(incident.id)}
                          className="mt-1 rounded border border-white/20 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                        >
                          Resolver incidente
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">THE VAULT (Infra + Pixel Sync)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Vault:{" "}
            <span className={fortress.vault.overallStatus === "blocked" ? "text-[#EA4335]" : fortress.vault.overallStatus === "warning" ? "text-[#FF9900]" : "text-[#10B981]"}>
              {fortress.vault.overallStatus.toUpperCase()}
            </span>{" "}
            | Pixel Sync:{" "}
            <span className={fortress.pixelSync.status === "unhealthy" ? "text-[#EA4335]" : fortress.pixelSync.status === "healthy" ? "text-[#10B981]" : "text-[#FF9900]"}>
              {fortress.pixelSync.status.toUpperCase()}
            </span>
          </p>
          <p className="text-xs text-slate-300">
            Reais: {fortress.pixelSync.realPurchases} vs Meta: {fortress.pixelSync.metaReportedPurchases} (
            {fortress.pixelSync.discrepancyPct.toFixed(2)}%)
          </p>
          {fortress.pixelSync.status === "unhealthy" && <Badge variant="danger">ERRO DE CAPI/PIXEL: discrepancia acima de 20%</Badge>}
          {fortress.vault.domains.map((domain) => (
            <div key={domain.domain} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
              <p className="text-slate-200">{domain.domain}</p>
              <p className="text-slate-400">
                Safe Browsing: {domain.safeBrowsingStatus} | Debugger: {domain.facebookDebuggerStatus} | Check: {domain.checkedAt}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kill Switch Algoritmico (MER + Domain Health)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!killSwitch ? (
            <p className="text-slate-400">Kill switch ainda nao inicializado.</p>
          ) : (
            <>
              <p>
                Status:{" "}
                <span className={killSwitch.active ? "text-[#EA4335]" : "text-[#10B981]"}>
                  {killSwitch.active ? "ATIVO" : "EM MONITORAMENTO"}
                </span>{" "}
                | Janela pico {killSwitch.peakWindow}
              </p>
              <p className="text-xs text-slate-300">
                Regra: MER &lt; {killSwitch.merThreshold.toFixed(1)} por {killSwitch.requiredDurationMinutes} min.
              </p>
              <p className="text-xs text-slate-400">{killSwitch.reason}</p>
              {killSwitch.belowThresholdSince ? (
                <p className="text-xs text-slate-400">
                  Abaixo do limiar desde: {new Date(killSwitch.belowThresholdSince).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : null}
              {killSwitch.autoTrafficBlocked ? (
                <Badge variant="danger">AUTO-BLOCK DE TRAFEGO ATIVO</Badge>
              ) : (
                <Badge variant="success">Trafego liberado</Badge>
              )}
              <p className="text-[11px] text-slate-500">Alertas enviados para heads: {killSwitch.alertsSent}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traffic Router de Contingencia (MVP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {routingRules.length === 0 ? (
            <p className="rounded border border-white/10 bg-white/5 p-2 text-slate-400">Carregando regras de roteamento...</p>
          ) : (
            routingRules.slice(0, 3).map((rule) => (
              <div key={rule.id} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="text-slate-100">
                  {rule.offerId} | modo {rule.mode}
                </p>
                <p className="text-slate-300">Ativo: {rule.activeUrl}</p>
                <p className="text-slate-500">Primary: {rule.primaryUrl}</p>
                <p className="text-slate-500">Motivo: {rule.reason}</p>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => void forceRoutingFailover()}
            className="rounded border border-[#FF9900]/40 bg-[#FF9900]/15 px-3 py-1.5 text-[11px] text-[#FFD39A]"
          >
            Forcar failover manual
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LCP Monitor</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className={tech.lcpSeconds <= 1.5 ? "text-[#34A853]" : "text-[#EA4335]"}>
            LCP atual: {tech.lcpSeconds.toFixed(2)}s
          </p>
          {tech.lcpSeconds > 1.5 && <Badge variant="danger">ALERTA HEAD TECH: LCP acima de 1.5s</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A/B Test Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tech.abTests.map((test) => (
            <div key={test.test} className="rounded-md border border-white/10 bg-white/5 p-2 text-sm">
              <p>{test.test}</p>
              <p className="text-xs text-slate-400">
                A: {percent(test.variantA)} | B: {percent(test.variantB)} | Winner: {test.winner}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkout Efficiency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Abandono de Carrinho: {percent(tech.checkout.cartAbandonment)}</p>
          <p>Conversao de Checkout: {percent(tech.checkout.checkoutConversion)}</p>
          <p className="text-slate-400">
            IC Rate global DSS: {intelligence.metrics.icRate.toFixed(2)}% (alvo &gt; {ELITE_BENCHMARKS.icRate}%)
          </p>
          {tech.checkout.gatewayAlert && <Badge variant="warning">Gateway com queda de performance</Badge>}
          {tech.checkout.cartAbandonment > 60 && (
            <Badge variant="danger">CRITICAL: abandono de carrinho acima de 60% (Yampi)</Badge>
          )}
          {intelligence.metrics.icRate < ELITE_BENCHMARKS.icRate && (
            <Badge variant="danger">Alerta DSS: friccao detectada em checkout</Badge>
          )}
          {intelligence.gatewayHealth.alert && (
            <Badge variant="danger">
              APPMAX ALERTA: aprovacao caiu {intelligence.gatewayHealth.dropPct.toFixed(2)}% vs dia anterior
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upsell Flow Visualizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tech.upsellFlow.map((step) => (
            <div key={step.step}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{step.step}</span>
                <span>{percent(step.clickRate)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-[#FF9900]" style={{ width: `${Math.min(100, step.clickRate)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <HealthCheck baselineDropRate={data.oldSchema?.tech?.pageLoadDropOff ?? 18} />
    </section>
  );
}
