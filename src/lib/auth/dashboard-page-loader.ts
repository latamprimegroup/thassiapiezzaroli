import { sanitizeWarRoomDataForRole } from "@/lib/auth/sanitize-war-room-data";
import { demoUsers, getDemoUserById } from "@/lib/auth/users";
import type { UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";

export async function loadDashboardPageData() {
  const session = await getSessionFromCookies();
  const role: UserRole = session?.role ?? "videoEditor";
  const fallbackUser = demoUsers.find((user) => user.role === role) ?? demoUsers[0];
  const currentUser = getDemoUserById(session?.userId ?? "") ?? fallbackUser;
  const data = sanitizeWarRoomDataForRole(await getWarRoomData(), role);
  return {
    role,
    currentUser,
    data,
    users: demoUsers,
  };
}
