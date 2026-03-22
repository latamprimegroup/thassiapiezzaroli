import type { UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";
import { secureEquals } from "@/lib/security/secure-compare";

const DEFAULT_OPS_ROLES: UserRole[] = ["ceo", "techAdmin", "ctoDev"];

export async function isOpsAuthorized(request: Request, allowedRoles?: UserRole[]) {
  const expected = process.env.WAR_ROOM_WEBHOOK_API_KEY;
  const apiKey = request.headers.get("x-api-key")?.trim();
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (expected && (secureEquals(apiKey, expected) || secureEquals(bearer, expected))) {
    return true;
  }

  // Fail-closed: sem API key válida, somente sessão com papel autorizado.
  const session = await getSessionFromCookies();
  if (!session) {
    return false;
  }
  const effectiveRoles = allowedRoles && allowedRoles.length > 0 ? allowedRoles : DEFAULT_OPS_ROLES;
  return effectiveRoles.includes(session.role);
}
