"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertOctagon, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WarRoomData } from "@/lib/war-room/types";

type ContingencyMonitorProps = {
  contingency: WarRoomData["contingency"];
};

function statusVariant(status: "ok" | "warning" | "blocked") {
  if (status === "blocked") {
    return "danger" as const;
  }
  if (status === "warning") {
    return "warning" as const;
  }
  return "success" as const;
}

export function ContingencyMonitor({ contingency }: ContingencyMonitorProps) {
  const hadCritical = useRef(false);
  const criticalCount = useMemo(() => {
    const all = [...contingency.domains, ...contingency.adAccounts, ...contingency.fanpages];
    return all.filter((item) => item.status === "blocked" || item.score < 50).length;
  }, [contingency.adAccounts, contingency.domains, contingency.fanpages]);

  useEffect(() => {
    if (criticalCount <= 0 || hadCritical.current) {
      return;
    }

    hadCritical.current = true;

    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 860;
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);

    return () => {
      void context.close();
    };
  }, [criticalCount]);

  return (
    <Card className={criticalCount > 0 ? "border-rose-300/40 bg-rose-500/10" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {criticalCount > 0 ? <AlertOctagon className="h-4 w-4 text-rose-300" /> : <ShieldAlert className="h-4 w-4 text-cyan-300" />}
          Painel de Contingencia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {criticalCount > 0 && (
          <div className="rounded-md border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            ALERTA IMEDIATO: {criticalCount} ativo(s) com queda de score ou bloqueio detectado(s).
          </div>
        )}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Dominios</p>
          {contingency.domains.map((domain) => (
            <div key={domain.name} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
              <span className="text-sm text-slate-100">{domain.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(domain.status)}>score {domain.score}</Badge>
                <span className="text-xs text-slate-400">{domain.lastCheck}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Contas de Midia</p>
          {contingency.adAccounts.map((account) => (
            <div key={account.name} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
              <span className="text-sm text-slate-100">{account.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(account.status)}>score {account.score}</Badge>
                <span className="text-xs text-slate-400">{account.lastCheck}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Fanpages</p>
          {contingency.fanpages.map((page) => (
            <div key={page.name} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
              <span className="text-sm text-slate-100">{page.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(page.status)}>score {page.score}</Badge>
                <span className="text-xs text-slate-400">{page.lastCheck}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
