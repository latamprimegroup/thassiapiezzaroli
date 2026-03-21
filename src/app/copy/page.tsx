import Dashboard from "@/components/Dashboard";
import { canAccessAppRoute, defaultRouteForRole } from "@/lib/auth/rbac";
import { loadDashboardPageData } from "@/lib/auth/dashboard-page-loader";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function CopyRoutePage() {
  const payload = await loadDashboardPageData();
  if (!canAccessAppRoute(payload.role, "copy")) {
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
      initialSection="copyResearch"
    />
  );
}
