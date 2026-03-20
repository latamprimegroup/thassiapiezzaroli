import { NextResponse } from "next/server";
import { rolePermissions, type UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";
import { sanitizeWarRoomDataForRole } from "@/lib/auth/sanitize-war-room-data";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  const role: UserRole = session?.role ?? "videoEditor";
  const data = sanitizeWarRoomDataForRole(await getWarRoomData(), role);

  return NextResponse.json({
    data,
    session: {
      role,
      userId: session?.userId ?? "anonymous",
      allowedSections: rolePermissions[role].allowedSections,
    },
  });
}
