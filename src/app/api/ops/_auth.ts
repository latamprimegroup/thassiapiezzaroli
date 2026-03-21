import type { UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function isOpsAuthorized(request: Request, allowedRoles?: UserRole[]) {
  const expected = process.env.WAR_ROOM_WEBHOOK_API_KEY;
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (expected && (apiKey === expected || bearer === expected)) {
    return true;
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return !expected;
  }
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }
  return allowedRoles.includes(session.role);
}
