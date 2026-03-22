import type { UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";
import { SNIPER_ALLOWED_ROLES } from "@/lib/sniper-crm/sniper-crm-service";

export async function requireSniperSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    return {
      ok: false as const,
      status: 401,
      error: "Nao autenticado.",
      session: null,
    };
  }
  if (!SNIPER_ALLOWED_ROLES.includes(session.role)) {
    return {
      ok: false as const,
      status: 403,
      error: "Perfil sem acesso ao Sniper CRM.",
      session: null,
    };
  }
  return {
    ok: true as const,
    status: 200,
    error: "",
    session,
  };
}

export function isCeo(role: UserRole) {
  return role === "ceo";
}

