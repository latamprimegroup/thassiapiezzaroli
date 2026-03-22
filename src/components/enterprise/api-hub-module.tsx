"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProviderStatus = {
  provider: "utmify" | "appmax" | "kiwify" | "yampi" | "cloudflare";
  status: "api" | "manual" | "missing";
  tokenPreview: string;
};

type ApiHubPayload = {
  mode: "auto" | "manual";
  updatedAt: string;
  providers: ProviderStatus[];
};

export function ApiHubModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<ApiHubPayload>({
    mode: "auto",
    updatedAt: "",
    providers: [],
  });
  const [tokens, setTokens] = useState<Record<string, string>>({
    utmify: "",
    appmax: "",
    kiwify: "",
    yampi: "",
    cloudflare: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/api-hub", { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
      setError("Falha ao carregar API Hub.");
      setLoading(false);
      return;
    }
    const data = (await response.json().catch(() => null)) as ApiHubPayload | null;
    if (!data) {
      setError("Resposta invalida do API Hub.");
      setLoading(false);
      return;
    }
    setPayload(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/api-hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: payload.mode,
        tokens,
      }),
    }).catch(() => null);
    if (!response || !response.ok) {
      setError("Falha ao salvar tokens.");
      setSaving(false);
      return;
    }
    setSaving(false);
    void load();
  }

  return (
    <section className="war-fade-in space-y-4">
      <Card className="border-[#FF9900]/40 bg-[#0b0b0b]">
        <CardHeader>
          <CardTitle className="text-base">API Hub (secreto) - Integrações do Tech Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">
            <p className="text-slate-300">
              Última atualização:{" "}
              <span className="text-slate-100">
                {payload.updatedAt ? new Date(payload.updatedAt).toLocaleString("pt-BR") : "N/A"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-8 px-3 text-xs"
              onClick={() => setPayload((prev) => ({ ...prev, mode: "auto" }))}
            >
              Modo API (auto)
            </Button>
            <Button
              type="button"
              className="h-8 px-3 text-xs"
              onClick={() => setPayload((prev) => ({ ...prev, mode: "manual" }))}
            >
              Modo manual/offline
            </Button>
            <Badge variant={payload.mode === "auto" ? "success" : "warning"}>
              {payload.mode === "auto" ? "API ACTIVE" : "MANUAL OVERRIDE"}
            </Badge>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {(["utmify", "appmax", "kiwify", "yampi", "cloudflare"] as const).map((provider) => {
              const status = payload.providers.find((item) => item.provider === provider);
              return (
                <label key={provider} className="rounded border border-white/10 bg-black/30 p-2 text-xs">
                  <span className="mb-1 block uppercase text-slate-400">{provider}</span>
                  <input
                    type="password"
                    value={tokens[provider] ?? ""}
                    onChange={(event) => setTokens((prev) => ({ ...prev, [provider]: event.target.value }))}
                    placeholder={status?.tokenPreview || "Sem token salvo"}
                    className="h-8 w-full rounded border border-white/15 bg-slate-900/70 px-2"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Status:{" "}
                    <span
                      className={
                        status?.status === "api"
                          ? "text-[#10B981]"
                          : status?.status === "manual"
                            ? "text-[#FF9900]"
                            : "text-[#EA4335]"
                      }
                    >
                      {(status?.status || "missing").toUpperCase()}
                    </span>
                  </p>
                </label>
              );
            })}
          </div>

          <Button type="button" className="h-8 px-3 text-xs" onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>
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
