import { rolePermissions, type UserRole } from "./rbac";
import type { WarRoomData } from "@/lib/war-room/types";

export function sanitizeWarRoomDataForRole(input: WarRoomData, role: UserRole): WarRoomData {
  const permissions = rolePermissions[role];
  const data: WarRoomData = structuredClone(input);

  // Senior-only note: sensitive fields are sanitized server-side before serialization,
  // so client state tampering cannot recover hidden financial values.
  if (!permissions.canViewSensitiveFinancials) {
    data.finance.netRevenue = 0;
    data.finance.profitMargin = 0;
  }

  if (!permissions.canViewRoasReal) {
    data.liveAdsTracking = data.liveAdsTracking.map((row) => ({ ...row, roas: 0 }));
  }

  if (role === "videoEditor") {
    data.globalOverview.revenue = 0;
  }

  return data;
}
