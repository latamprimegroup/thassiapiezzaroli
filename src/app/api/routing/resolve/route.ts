import { NextResponse } from "next/server";
import { resolveTrafficRoute } from "@/lib/routing/traffic-router";
import { getSessionFromCookies } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offerId = url.searchParams.get("offerId") ?? "global";
  const resolved = await resolveTrafficRoute(offerId);
  const session = await getSessionFromCookies();
  const canViewDiagnostics = Boolean(
    session &&
      ["ceo", "techAdmin", "ctoDev", "headTraffic", "trafficSenior", "mediaBuyer", "financeManager", "cfo"].includes(
        session.role,
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
