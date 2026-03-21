import { NextResponse } from "next/server";
import { resolveTrafficRoute } from "@/lib/routing/traffic-router";
import { getSessionFromCookies } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const expectedApiKey = process.env.WAR_ROOM_WEBHOOK_API_KEY;
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const machineAuthorized = Boolean(expectedApiKey && (apiKey === expectedApiKey || bearer === expectedApiKey));
  const session = await getSessionFromCookies();
  if (!session && !machineAuthorized && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const url = new URL(request.url);
  const offerId = url.searchParams.get("offerId") ?? "global";
  const resolved = await resolveTrafficRoute(offerId);
  const canViewDiagnostics = Boolean(
    (session || machineAuthorized) &&
      ["ceo", "techAdmin", "ctoDev", "headTraffic", "trafficSenior", "mediaBuyer", "financeManager", "cfo"].includes(
        session?.role ?? "techAdmin",
      ),
  );

  const passthrough = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "offerId") {
      continue;
    }
    passthrough.set(key, value);
  }
  const separator = resolved.activeUrl.includes("?") ? "&" : "?";
  const redirectUrl = passthrough.toString().length > 0 ? `${resolved.activeUrl}${separator}${passthrough.toString()}` : resolved.activeUrl;

  return NextResponse.json(
    canViewDiagnostics
      ? {
          ...resolved,
          redirectUrl,
        }
      : {
          offerId: resolved.offerId,
          redirectUrl,
        },
  );
}
