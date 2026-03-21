import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserRole } from "./rbac";

export const SESSION_COOKIE_NAME = "war_room_session";

type SessionPayload = {
  userId: string;
  role: UserRole;
  issuedAt: number;
};

const ALLOWED_ROLES: UserRole[] = [
  "ceo",
  "techAdmin",
  "ctoDev",
  "financeManager",
  "cfo",
  "cco",
  "headTraffic",
  "sdr",
  "copyJunior",
  "copySenior",
  "trafficJunior",
  "trafficSenior",
  "productionEditor",
  "productionDesigner",
  "closer",
  "cxManager",
  "mediaBuyer",
  "copywriter",
  "videoEditor",
];

function getSessionSecret() {
  return process.env.WAR_ROOM_SESSION_SECRET ?? "war-room-session-dev-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${raw}.${sign(raw)}`;
}

function decode(token: string): SessionPayload | null {
  const [raw, signature] = token.split(".");
  if (!raw || !signature) {
    return null;
  }

  const expected = sign(raw);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed?.userId || !parsed?.role || !ALLOWED_ROLES.includes(parsed.role)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string, role: UserRole) {
  return encode({ userId, role, issuedAt: Date.now() });
}

export function readSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }
  return decode(token);
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const supabaseSession = readSupabaseAuthSession(cookieStore.getAll());
  if (supabaseSession) {
    return supabaseSession;
  }
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return readSessionToken(token);
}

function readSupabaseAuthSession(cookieList: Array<{ name: string; value: string }>): SessionPayload | null {
  const candidateTokens: string[] = [];
  for (const cookie of cookieList) {
    if (cookie.name === "sb-access-token" || cookie.name.includes("-auth-token") || cookie.name.includes("-access-token")) {
      const extracted = extractAccessToken(cookie.value);
      if (extracted) {
        candidateTokens.push(extracted);
      }
    }
  }

  for (const accessToken of candidateTokens) {
    const claims = parseJwtClaims(accessToken);
    if (!claims) {
      continue;
    }
    const roleCandidate = readRoleFromClaims(claims);
    const userId = readUserIdFromClaims(claims);
    if (!roleCandidate || !userId || !ALLOWED_ROLES.includes(roleCandidate)) {
      continue;
    }
    return {
      userId,
      role: roleCandidate,
      issuedAt: Date.now(),
    };
  }

  return null;
}

function extractAccessToken(rawValue: string) {
  const decodedCandidates = [rawValue, safeDecodeURIComponent(rawValue), safeBase64Decode(rawValue)].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of decodedCandidates) {
    if (candidate.split(".").length === 3) {
      return candidate;
    }

    const parsed = safeJsonParse(candidate);
    if (!parsed) {
      continue;
    }

    if (typeof parsed === "object" && parsed !== null) {
      const objectToken = (parsed as { access_token?: unknown }).access_token;
      if (typeof objectToken === "string" && objectToken.split(".").length === 3) {
        return objectToken;
      }
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string" && item.split(".").length === 3) {
          return item;
        }
        if (typeof item === "object" && item !== null) {
          const nestedToken = (item as { access_token?: unknown }).access_token;
          if (typeof nestedToken === "string" && nestedToken.split(".").length === 3) {
            return nestedToken;
          }
        }
      }
    }
  }

  return "";
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readRoleFromClaims(claims: Record<string, unknown>): UserRole | null {
  const directRole = claims.user_role ?? claims.role;
  if (typeof directRole === "string" && ALLOWED_ROLES.includes(directRole as UserRole)) {
    return directRole as UserRole;
  }

  const appMetadata = claims.app_metadata;
  if (typeof appMetadata === "object" && appMetadata !== null) {
    const nestedRole = (appMetadata as { user_role?: unknown; role?: unknown }).user_role ?? (appMetadata as { role?: unknown }).role;
    if (typeof nestedRole === "string" && ALLOWED_ROLES.includes(nestedRole as UserRole)) {
      return nestedRole as UserRole;
    }
  }

  return null;
}

function readUserIdFromClaims(claims: Record<string, unknown>) {
  const candidate = claims.sub ?? claims.user_id;
  return typeof candidate === "string" ? candidate : "";
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function safeBase64Decode(value: string) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
