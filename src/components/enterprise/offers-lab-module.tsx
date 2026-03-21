"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { subscribeWarRoomRealtime } from "@/lib/realtime/war-room-realtime";
import type { OffersLabDashboard } from "@/lib/offers/types";

type ApiPayload = {
  data: OffersLabDashboard;
  filters: {
    niches: string[];
    owners: string[];
  };
};

type OfferFormState = {
  name: string;
  niche: string;
  ownerId: string;
  trafficSource: string;
  utmBroughtBy: string;
  minRoasTarget: string;
  bigIdea: string;
  uniqueMechanism: string;
  sophisticationLevel: string;
  hookVariations: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatRoas(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
}

function toIsoClock(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  return parsed.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const EMPTY_DASHBOARD: OffersLabDashboard = {
  offers: [],
  validatedOffers: [],
  sources: [],
  sync: {
    lastSyncAt: "",
    lastStatus: "idle",
    lastMessage: "",
  },
};

export function OffersLabModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<ApiPayload>({
    data: EMPTY_DASHBOARD,
    filters: { niches: [], owners: [] },
  });
  const [filters, setFilters] = useState({
    niche: "",
    ownerId: "",
    minRoas: "",
    validatedOnly: true,
  });
  const [checklist, setChecklist] = useState({
    sourceNormalized: false,
    campaignWithNameId: false,
    contentWithNameId: false,
    termWithNameId: false,
    networkingTagged: false,
  });
  const [form, setForm] = useState<OfferFormState>({
    name: "",
    niche: "",
    ownerId: "",
    trafficSource: "meta",
    utmBroughtBy: "",
    minRoasTarget: "1.8",
    bigIdea: "",
    uniqueMechanism: "",
    sophisticationLevel: "3",
    hookVariations: "",
  });

  const validationChecklistReady = useMemo(() => {
    const baseReady =
      checklist.sourceNormalized &&
      checklist.campaignWithNameId &&
      checklist.contentWithNameId &&
      checklist.termWithNameId;
    if (form.trafficSource !== "networking") {
      return baseReady;
    }
    return baseReady && checklist.networkingTagged;
  }, [checklist, form.trafficSource]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (filters.niche) {
      query.set("niche", filters.niche);
    }
    if (filters.ownerId) {
      query.set("ownerId", filters.ownerId);
    }
    if (filters.minRoas) {
      query.set("minRoas", filters.minRoas);
    }
    query.set("validatedOnly", String(filters.validatedOnly));
    const response = await fetch(`/api/offers-lab?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
      setLoading(false);
      setError("Falha ao carregar Offers Lab.");
      return;
    }
    const data = (await response.json().catch(() => null)) as ApiPayload | null;
    if (!data) {
      setLoading(false);
      setError("Resposta invalida do backend.");
      return;
    }
    setPayload(data);
    setLoading(false);
  }, [filters.niche, filters.ownerId, filters.minRoas, filters.validatedOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchDashboard();
    }, WAR_ROOM_OPS_CONSTANTS.performance.dashboardRefreshMs);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      unsubscribe = await subscribeWarRoomRealtime(() => {
        void fetchDashboard();
      });
    })();
    return () => {
      unsubscribe?.();
    };
  }, [fetchDashboard]);

  async function saveOffer() {
    if (!validationChecklistReady) {
      setError("Checklist de UTM incompleto. Corrija antes de salvar.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/offers-lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        niche: form.niche,
        ownerId: form.ownerId,
        trafficSource: form.trafficSource,
        utmBroughtBy: form.utmBroughtBy,
        minRoasTarget: Number(form.minRoasTarget),
        bigIdea: form.bigIdea,
        uniqueMechanism: form.uniqueMechanism,
        sophisticationLevel: Number(form.sophisticationLevel),
        hookVariations: form.hookVariations
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    }).catch(() => null);
    if (!response || !response.ok) {
      const body = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
      setError(body?.error ?? "Falha ao salvar oferta.");
      setSaving(false);
      return;
    }
    setForm({
      name: "",
      niche: form.niche,
      ownerId: form.ownerId,
      trafficSource: form.trafficSource,
      utmBroughtBy: "",
      minRoasTarget: form.minRoasTarget,
      bigIdea: "",
      uniqueMechanism: "",
      sophisticationLevel: form.sophisticationLevel,
      hookVariations: "",
    });
    setSaving(false);
    void fetchDashboard();
  }

  async function runSync() {
    setSyncing(true);
    setError("");
    const response = await fetch("/api/offers-lab/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);
    if (!response || !response.ok) {
      setError("Falha ao sincronizar com UTMify.");
      setSyncing(false);
      return;
    }
    setSyncing(false);
    void fetchDashboard();
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-[#FF9900]/35 bg-[#0b0b0b]">
        <CardHeader>
          <CardTitle className="text-base">PRODUCTION & OFFERS LAB</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Ecossistema de inteligencia de ativos com validacao automatica (Regra dos 70k).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-400">Ofertas monitoradas</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{payload.data.offers.length}</p>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-400">Validadas (&gt;=70k)</p>
            <p className="mt-1 text-lg font-semibold text-[#10B981]">{payload.data.validatedOffers.length}</p>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-400">Ultimo sync UTMify</p>
            <p className="mt-1 text-slate-100">{toIsoClock(payload.data.sync.lastSyncAt)}</p>
            <Badge variant={payload.data.sync.lastStatus === "ok" ? "success" : payload.data.sync.lastStatus === "error" ? "danger" : "default"}>
              {payload.data.sync.lastStatus.toUpperCase()}
            </Badge>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-3 text-xs">
            <p className="text-slate-400">Automacao 15 min</p>
            <p className="mt-1 text-slate-300">{payload.data.sync.lastMessage || "Aguardando execucao inicial do cron."}</p>
            <Button type="button" className="mt-2 h-7 text-[11px]" disabled={syncing} onClick={() => void runSync()}>
              {syncing ? "Sincronizando..." : "Sync agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">Mapeamento de Ativos (Input de Copy)</CardTitle>
            <CardDescription className="text-xs">
              Big Idea, Mecanismo, Sofisticacao e variacoes de hook vinculadas a cada oferta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="Nome da oferta"
              />
              <input
                value={form.niche}
                onChange={(event) => setForm((prev) => ({ ...prev, niche: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="Nicho"
              />
              <input
                value={form.ownerId}
                onChange={(event) => setForm((prev) => ({ ...prev, ownerId: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="Responsavel (owner_id)"
              />
              <select
                value={form.trafficSource}
                onChange={(event) => setForm((prev) => ({ ...prev, trafficSource: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              >
                <option value="meta">Meta</option>
                <option value="google">Google</option>
                <option value="tiktok">TikTok</option>
                <option value="kwai">Kwai</option>
                <option value="networking">Networking</option>
              </select>
              <input
                value={form.minRoasTarget}
                onChange={(event) => setForm((prev) => ({ ...prev, minRoasTarget: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="ROAS alvo minimo"
              />
              <input
                value={form.sophisticationLevel}
                onChange={(event) => setForm((prev) => ({ ...prev, sophisticationLevel: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
                placeholder="Sofisticacao (1-5)"
              />
              <input
                value={form.bigIdea}
                onChange={(event) => setForm((prev) => ({ ...prev, bigIdea: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs md:col-span-2"
                placeholder="Big Idea"
              />
              <input
                value={form.uniqueMechanism}
                onChange={(event) => setForm((prev) => ({ ...prev, uniqueMechanism: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs md:col-span-2"
                placeholder="Mecanismo Unico"
              />
              <input
                value={form.hookVariations}
                onChange={(event) => setForm((prev) => ({ ...prev, hookVariations: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs md:col-span-2"
                placeholder="Variacoes de Hook (H01,H02,H03...)"
              />
              <input
                value={form.utmBroughtBy}
                onChange={(event) => setForm((prev) => ({ ...prev, utmBroughtBy: event.target.value }))}
                className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs md:col-span-2"
                placeholder="utm_brought_by (obrigatorio para networking)"
              />
            </div>

            <Button type="button" disabled={saving} onClick={() => void saveOffer()}>
              {saving ? "Salvando..." : "Registrar oferta"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#080808]">
          <CardHeader>
            <CardTitle className="text-base">Checklist de Validacao UTM (Copy)</CardTitle>
            <CardDescription className="text-xs">
              Gate obrigatorio antes de subir trafego. Padrao Nome|ID em campaign/content/term.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { key: "sourceNormalized", label: "utm_source normalizada (meta/google/tiktok/kwai/networking)" },
              { key: "campaignWithNameId", label: "utm_campaign no formato Nome|ID" },
              { key: "contentWithNameId", label: "utm_content no formato Nome|ID" },
              { key: "termWithNameId", label: "utm_term no formato Nome|ID (ou keyword canonical)" },
              { key: "networkingTagged", label: "utm_brought_by preenchido para networking" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={checklist[item.key as keyof typeof checklist]}
                  onChange={(event) =>
                    setChecklist((prev) => ({
                      ...prev,
                      [item.key]: event.target.checked,
                    }))
                  }
                />
                <span className="text-slate-200">{item.label}</span>
              </label>
            ))}
            <div className={`rounded border p-2 text-xs ${validationChecklistReady ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-[#FF9900]/35 bg-[#FF9900]/10 text-[#FFD39A]"}`}>
              {validationChecklistReady
                ? "Checklist OK: padrao UTM apto para trafego."
                : "Checklist incompleto: bloqueie deploy da oferta ate concluir os itens."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#080808]">
        <CardHeader>
          <CardTitle className="text-base">Fontes de Trafego (Origem Real das Vendas)</CardTitle>
          <CardDescription className="text-xs">Atribuicao consolidada por canal normalizado.</CardDescription>
        </CardHeader>
        <CardContent>
          {payload.data.sources.length === 0 ? (
            <div className="rounded border border-dashed border-white/15 p-3 text-xs text-slate-500">
              Nenhuma venda atribuida ainda no Offers Lab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Fonte</th>
                    <th className="py-2 pr-3">Vendas</th>
                    <th className="py-2 pr-3">Receita</th>
                    <th className="py-2 pr-3">Investimento</th>
                    <th className="py-2 pr-3">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.data.sources.map((row) => (
                    <tr key={row.source} className="border-t border-white/10">
                      <td className="py-2 pr-3 uppercase text-slate-200">{row.source}</td>
                      <td className="py-2 pr-3 text-slate-300">{row.salesCount}</td>
                      <td className="py-2 pr-3 text-[#10B981]">{formatCurrency(row.revenue)}</td>
                      <td className="py-2 pr-3 text-slate-300">{formatCurrency(row.spend)}</td>
                      <td className="py-2 pr-3 text-slate-100">{formatRoas(row.roas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#080808]">
        <CardHeader>
          <CardTitle className="text-base">Ofertas Validadas (&gt;= R$ 70k em 7D)</CardTitle>
          <CardDescription className="text-xs">
            Filtros por nicho, responsavel e ROAS para decisao de escala.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <select
              value={filters.niche}
              onChange={(event) => setFilters((prev) => ({ ...prev, niche: event.target.value }))}
              className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
            >
              <option value="">Todos os nichos</option>
              {payload.filters.niches.map((niche) => (
                <option key={niche} value={niche}>
                  {niche}
                </option>
              ))}
            </select>
            <select
              value={filters.ownerId}
              onChange={(event) => setFilters((prev) => ({ ...prev, ownerId: event.target.value }))}
              className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
            >
              <option value="">Todos os responsaveis</option>
              {payload.filters.owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
            <input
              value={filters.minRoas}
              onChange={(event) => setFilters((prev) => ({ ...prev, minRoas: event.target.value }))}
              className="h-8 rounded border border-white/15 bg-black/40 px-2 text-xs"
              placeholder="ROAS minimo"
            />
            <label className="flex items-center gap-2 rounded border border-white/15 bg-black/40 px-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={filters.validatedOnly}
                onChange={(event) => setFilters((prev) => ({ ...prev, validatedOnly: event.target.checked }))}
              />
              Mostrar apenas validadas
            </label>
          </div>

          {loading ? (
            <div className="rounded border border-white/10 bg-black/30 p-3 text-xs text-slate-500">Carregando...</div>
          ) : payload.data.offers.length === 0 ? (
            <div className="rounded border border-dashed border-white/15 p-3 text-xs text-slate-500">
              Nenhuma oferta encontrada para os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Oferta</th>
                    <th className="py-2 pr-3">Nicho</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Revenue 7D</th>
                    <th className="py-2 pr-3">ROAS 7D</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Sof.</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.data.offers.map((offer) => (
                    <tr key={offer.id} className="border-t border-white/10">
                      <td className="py-2 pr-3">
                        <p className="text-slate-100">{offer.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{offer.id}</p>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{offer.niche || "-"}</td>
                      <td className="py-2 pr-3 text-slate-300">{offer.ownerId || "-"}</td>
                      <td className="py-2 pr-3 text-[#10B981]">{formatCurrency(offer.revenue7d)}</td>
                      <td className="py-2 pr-3 text-slate-100">{formatRoas(offer.roas7d)}</td>
                      <td className="py-2 pr-3">
                        {offer.validatedForScale ? (
                          <Badge variant="success">{offer.candidateLaunch ? "CANDIDATA LANCAMENTO" : "VALIDADA"}</Badge>
                        ) : (
                          <Badge variant="warning">{offer.status.toUpperCase()}</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{offer.sophisticationLevel}/5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-300/30 bg-rose-500/10">
          <CardContent className="p-3 text-xs text-rose-100">{error}</CardContent>
        </Card>
      )}
    </section>
  );
}

