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
    data.finance.contributionMargin = 0;
    data.finance.ltv24h = 0;
    data.finance.upsellTakeRate = 0;
    data.enterprise.ceoFinance.netProfit = 0;
    data.enterprise.ceoFinance.grossRevenue = 0;
    data.enterprise.ceoFinance.gatewayFees = 0;
    data.enterprise.ceoFinance.nfseTaxes = 0;
    data.enterprise.ceoFinance.taxProvision = 0;
    data.enterprise.ceoFinance.mer = 0;
  }

  if (!permissions.canViewRoasReal) {
    data.liveAdsTracking = data.liveAdsTracking.map((row) => ({
      ...row,
      roas: 0,
      trend24h: {
        ...row.trend24h,
        roas: row.trend24h.roas.map(() => 0),
      },
    }));
  }

  if (role === "videoEditor") {
    data.globalOverview.revenue = 0;
    data.globalOverview.trafficSources = data.globalOverview.trafficSources.map((source) => ({
      ...source,
      spend: 0,
    }));
    data.enterprise.trafficAttribution.deepAttribution = data.enterprise.trafficAttribution.deepAttribution.map((item) => ({
      ...item,
      netProfit: 0,
    }));
  }

  return data;
}
