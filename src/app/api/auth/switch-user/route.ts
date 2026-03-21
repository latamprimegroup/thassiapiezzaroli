import { NextResponse } from "next/server";
import { defaultRouteForRole } from "@/lib/auth/rbac";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getDemoUserById } from "@/lib/auth/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
