import Dashboard from "@/components/Dashboard";
import { redirect } from "next/navigation";
import { defaultRouteForRole } from "@/lib/auth/rbac";
import { loadDashboardPageData } from "@/lib/auth/dashboard-page-loader";

export const runtime = "nodejs";

export default async function Home() {
  const payload = await loadDashboardPageData({ requireSession: true });
  if (!payload) {
    redirect("/auth-required");
  }
  const route = defaultRouteForRole(payload.role);
  if (route !== "/") {
    redirect(route);
  }

  return (
    <Dashboard
      data={payload.data}
      users={payload.users}
      session={{
        userId: payload.currentUser.id,
        role: payload.role,
      }}
    />
  );
}
