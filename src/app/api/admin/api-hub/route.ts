import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { rolePermissions } from "@/lib/auth/rbac";
import { getApiHubStore, maskToken, updateApiHubStore, type ApiHubProvider } from "@/lib/tech-admin/api-hub-store";

export const runtime = "nodejs";

const PROVIDERS: ApiHubProvider[] = ["utmify", "appmax", "kiwify", "yampi", "cloudflare"];

function buildProviderStatus(mode: "auto" | "manual", token: string) {
  if (mode === "manual") {
    return "manual";
  }
  if (token.trim().length > 0) {
    return "api";
  }
  return "missing";
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const permissions = rolePermissions[session.role];
  const canReadSecret = permissions.canAccessApiHub;
  const canReadStatus = permissions.canViewSystemHealthMode || canReadSecret;
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  const payload = await getApiHubStore();

  const providerStatus = PROVIDERS.map((provider) => ({
    provider,
    status: buildProviderStatus(payload.mode, payload.tokens[provider]),
    tokenPreview: canReadSecret ? maskToken(payload.tokens[provider]) : "",
  }));

  if (view === "status") {
    if (!canReadStatus) {
      return NextResponse.json({ error: "Acesso restrito ao status do sistema." }, { status: 403 });
    }
    return NextResponse.json({
      mode: payload.mode,
      updatedAt: payload.updatedAt,
      providers: providerStatus.map((item) => ({ provider: item.provider, status: item.status })),
    });
  }

  if (!canReadSecret) {
    return NextResponse.json({ error: "Acesso restrito ao API Hub." }, { status: 403 });
  }

  return NextResponse.json({
    mode: payload.mode,
    updatedAt: payload.updatedAt,
    providers: providerStatus,
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }
  if (session.role !== "techAdmin" && session.role !== "ceo") {
    return NextResponse.json({ error: "Somente Tech Admin/CEO podem atualizar tokens." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "auto" | "manual";
    tokens?: Partial<Record<ApiHubProvider, string>>;
  };

  const next = await updateApiHubStore({
    mode: body.mode,
    tokens: body.tokens,
  });

  return NextResponse.json({
    ok: true,
    mode: next.mode,
    updatedAt: next.updatedAt,
  });
}
