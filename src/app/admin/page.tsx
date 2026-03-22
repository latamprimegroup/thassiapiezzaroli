import Dashboard from "@/components/Dashboard";
import { canAccessAppRoute, defaultRouteForRole } from "@/lib/auth/rbac";
import { loadDashboardPageData } from "@/lib/auth/dashboard-page-loader";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function AdminRoutePage() {
  const payload = await loadDashboardPageData({ requireSession: true });
  if (!payload) {
    redirect("/auth-required");
  }
  if (!canAccessAppRoute(payload.role, "admin")) {
    redirect(defaultRouteForRole(payload.role));
  }

  return (
    <Dashboard
      data={payload.data}
      users={payload.users}
      session={{
        userId: payload.currentUser.id,
        role: payload.role,
      }}
      initialSection="commandCenterCeo"
    />
  );
}
