import Dashboard from "@/components/Dashboard";
import type { UserRole } from "@/lib/auth/rbac";
import { getSessionFromCookies } from "@/lib/auth/session";
import { sanitizeWarRoomDataForRole } from "@/lib/auth/sanitize-war-room-data";
import { demoUsers, getDemoUserById } from "@/lib/auth/users";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";

export const runtime = "nodejs";

export default async function Home() {
  const session = await getSessionFromCookies();
  const role: UserRole = session?.role ?? "videoEditor";
  const fallbackUser = demoUsers.find((user) => user.role === role) ?? demoUsers[0];
  const currentUser = getDemoUserById(session?.userId ?? "") ?? fallbackUser;
  const data = sanitizeWarRoomDataForRole(await getWarRoomData(), role);

  return (
    <Dashboard
      data={data}
      users={demoUsers}
      session={{
        userId: currentUser.id,
        role,
      }}
    />
  );
}
