import { NextResponse } from "next/server";
import { rolePermissions, type UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";
import { demoUsers, getDemoUserById } from "@/lib/auth/users";
import { sanitizeWarRoomDataForRole } from "@/lib/auth/sanitize-war-room-data";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  const requireSession =
    process.env.WAR_ROOM_REQUIRE_SESSION === "true" || process.env.NODE_ENV === "production";
  if (!session && requireSession) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const role: UserRole = session?.role ?? "videoEditor";
  const fallbackUser = demoUsers.find((user) => user.role === role) ?? demoUsers[0];
  const currentUser = getDemoUserById(session?.userId ?? "") ?? fallbackUser;
  const data = sanitizeWarRoomDataForRole(await getWarRoomData(), role);

  return NextResponse.json({
    data,
    session: {
      role,
      userId: currentUser.id,
      externalUserId: session?.userId ?? currentUser.id,
      allowedSections: rolePermissions[role].allowedSections,
    },
  });
}
