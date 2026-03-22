import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WEBHOOK_EXEMPT_PATHS = new Set(["/api/webhooks/warroom", "/api/offers-lab/callback"]);

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function getAllowedOrigins(request: NextRequest) {
  const allowed = new Set<string>();
  allowed.add(request.nextUrl.origin);
  const appOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (appOrigin) {
    allowed.add(appOrigin);
  }
  const extraOrigins = (process.env.WAR_ROOM_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => normalizeOrigin(item.trim()))
    .filter((item) => item.length > 0);
  for (const origin of extraOrigins) {
    allowed.add(origin);
  }
  return allowed;
}

function readRequestOrigin(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get("origin") ?? "");
  if (origin) {
    return origin;
  }
  const referer = request.headers.get("referer") ?? "";
  return normalizeOrigin(referer);
}

function hasApiCredentials(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return Boolean(apiKey || bearer);
}

export function proxy(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  if (isApiRoute) {
    const allowedOrigins = getAllowedOrigins(request);
    const requestOrigin = readRequestOrigin(request);
    const trustedOrigin = requestOrigin ? allowedOrigins.has(requestOrigin) : false;
    const method = request.method.toUpperCase();
    const mutating = MUTATING_METHODS.has(method);
    const exemptPath = WEBHOOK_EXEMPT_PATHS.has(request.nextUrl.pathname);
    const machineRequest = hasApiCredentials(request);
    const isProd = process.env.NODE_ENV === "production";

    if (method === "OPTIONS") {
      if (!trustedOrigin && !machineRequest && isProd) {
        return NextResponse.json({ error: "Origin nao permitida para preflight." }, { status: 403 });
      }
      const preflight = new NextResponse(null, { status: 204 });
      preflight.headers.set("Vary", "Origin");
      preflight.headers.set(
        "Access-Control-Allow-Origin",
        trustedOrigin && requestOrigin ? requestOrigin : request.nextUrl.origin,
      );
      preflight.headers.set("Access-Control-Allow-Credentials", "true");
      preflight.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      preflight.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, x-api-key, x-requested-with",
      );
      preflight.headers.set("Access-Control-Max-Age", "86400");
      return preflight;
    }

    if (mutating && !exemptPath && !machineRequest && !trustedOrigin && isProd) {
      return NextResponse.json({ error: "Origin nao permitida para rota sensivel." }, { status: 403 });
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");

  if (isApiRoute) {
    const requestOrigin = readRequestOrigin(request);
    const trustedOrigin = requestOrigin ? getAllowedOrigins(request).has(requestOrigin) : false;
    response.headers.set("Vary", "Origin");
    if (trustedOrigin && requestOrigin) {
      response.headers.set("Access-Control-Allow-Origin", requestOrigin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-requested-with");
    }
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

