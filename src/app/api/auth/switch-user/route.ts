import { NextResponse } from "next/server";
import { defaultRouteForRole } from "@/lib/auth/rbac";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getDemoUserById } from "@/lib/auth/users";
import { isOpsAuthorized } from "@/app/api/ops/_auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const demoSwitchEnabled = process.env.WAR_ROOM_ENABLE_DEMO_SWITCH_USER === "true";
  if (!demoSwitchEnabled) {
    return NextResponse.json(
      { error: "Switch de usuario desabilitado." },
      { status: 403 },
    );
  }
  const authorized = await isOpsAuthorized(request, ["ceo", "techAdmin", "ctoDev"]);
  if (!authorized) {
    return NextResponse.json({ error: "Nao autorizado para switch de usuario." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { userId?: string };
  const user = payload.userId ? getDemoUserById(payload.userId) : null;

  if (!user) {
    return NextResponse.json({ error: "Usuario invalido." }, { status: 400 });
  }

  const token = createSessionToken(user.id, user.role);
  const response = NextResponse.json({
    ok: true,
    redirectTo: defaultRouteForRole(user.role),
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
