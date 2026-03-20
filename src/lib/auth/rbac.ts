import type { LucideIcon } from "lucide-react";
import { Clapperboard, Crown, PenSquare, SatelliteDish } from "lucide-react";

export type UserRole = "ceo" | "mediaBuyer" | "copywriter" | "videoEditor";

export type SectionId = "overview" | "facebook" | "googleYoutube" | "factory";

export type RolePermissions = {
  label: string;
  description: string;
  icon: LucideIcon;
  allowedSections: SectionId[];
  canViewSensitiveFinancials: boolean;
  canViewRoasReal: boolean;
  canApproveScaleCampaigns: boolean;
  canInputAuctionMetrics: boolean;
  canAlertSquad: boolean;
  canManageCreativeBacklog: boolean;
  canUploadCreativeVersions: boolean;
  emphasizeRetention: boolean;
  simplifiedPerformanceView: boolean;
};

export const rolePermissions: Record<UserRole, RolePermissions> = {
  ceo: {
    label: "CEO (Admin)",
    description: "Visao total e aprovacao final",
    icon: Crown,
    allowedSections: ["overview", "facebook", "googleYoutube", "factory"],
    canViewSensitiveFinancials: true,
    canViewRoasReal: true,
    canApproveScaleCampaigns: true,
    canInputAuctionMetrics: false,
    canAlertSquad: false,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: false,
    emphasizeRetention: false,
    simplifiedPerformanceView: false,
  },
  mediaBuyer: {
    label: "Media Buyer",
    description: "Leilao, CPA e acionamento de squads",
    icon: SatelliteDish,
    allowedSections: ["overview", "facebook", "googleYoutube", "factory"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: true,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: true,
    canAlertSquad: true,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: false,
    emphasizeRetention: false,
    simplifiedPerformanceView: false,
  },
  copywriter: {
    label: "Copywriter / Creative Director",
    description: "Engajamento, backlog e retencao",
    icon: PenSquare,
    allowedSections: ["facebook", "googleYoutube", "factory"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: true,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: false,
    canManageCreativeBacklog: true,
    canUploadCreativeVersions: false,
    emphasizeRetention: true,
    simplifiedPerformanceView: false,
  },
  videoEditor: {
    label: "Video Editor",
    description: "Performance por criativo e novas versoes",
    icon: Clapperboard,
    allowedSections: ["facebook", "googleYoutube", "factory"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: false,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: true,
    emphasizeRetention: true,
    simplifiedPerformanceView: true,
  },
};
