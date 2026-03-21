import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserRole } from "./rbac";

export const SESSION_COOKIE_NAME = "war_room_session";

type SessionPayload = {
  userId: string;
  role: UserRole;
  issuedAt: number;
};

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
    const allowedRoles: UserRole[] = ["ceo", "mediaBuyer", "copywriter", "videoEditor", "closer", "cxManager", "financeManager"];
    if (!parsed?.userId || !parsed?.role || !allowedRoles.includes(parsed.role)) {
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
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return readSessionToken(token);
}
