import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { getSessionFromCookies } from "@/lib/auth/session";
import { scanComplianceFromUrl } from "@/lib/compliance/compliance-scanner";
import type { UserRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

type Payload = {
  urls?: string[];
};

const ALLOWED_ROLES: UserRole[] = ["ceo", "techAdmin", "ctoDev", "financeManager", "cfo", "headTraffic"];

function parseAllowedHosts() {
  return (process.env.WAR_ROOM_COMPLIANCE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return a === 10 || (a === 127 && b >= 0) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function isHostAllowed(hostname: string) {
  const allowedHosts = parseAllowedHosts();
  if (allowedHosts.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
}

function validateTargetUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL invalida." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "Somente protocolos http/https sao permitidos." };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { ok: false, reason: "Host local/interno nao permitido para scanner." };
  }
  const ipVersion = isIP(hostname);
  if ((ipVersion === 4 && isPrivateIpv4(hostname)) || (ipVersion === 6 && isPrivateIpv6(hostname))) {
    return { ok: false, reason: "IP privado/loopback nao permitido para scanner." };
  }
  if (!isHostAllowed(hostname)) {
    return { ok: false, reason: "Host nao permitido pela policy de compliance scanner." };
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { ok: false, reason: "Porta nao permitida para compliance scanner." };
  }
  return { ok: true, normalizedUrl: parsed.toString() };
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Perfil sem permissao para Compliance Scanner." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const candidateUrls = Array.isArray(payload.urls)
    ? payload.urls.map((value) => value.trim()).filter((value) => value.length > 0).slice(0, 10)
    : [];
  if (candidateUrls.length === 0) {
    return NextResponse.json({ error: "Informe ao menos uma URL para o scanner." }, { status: 400 });
  }
  const validation = candidateUrls.map((url) => validateTargetUrl(url));
  const firstInvalid = validation.find((result) => !result.ok);
  if (firstInvalid && !firstInvalid.ok) {
    return NextResponse.json({ error: firstInvalid.reason }, { status: 400 });
  }
  const urls = validation
    .filter((result): result is { ok: true; normalizedUrl: string } => result.ok)
    .map((result) => result.normalizedUrl);

  const results = await Promise.all(urls.map((url) => scanComplianceFromUrl(url)));
  return NextResponse.json({
    ok: true,
    scannedAt: new Date().toISOString(),
    results,
  });
}
