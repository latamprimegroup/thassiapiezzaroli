import type { LucideIcon } from "lucide-react";
import { Clapperboard, Crown, Handshake, HeartPulse, PenSquare, SatelliteDish, ShieldCheck } from "lucide-react";

export type UserRole = "ceo" | "mediaBuyer" | "copywriter" | "videoEditor" | "closer" | "cxManager" | "financeManager";

export type SectionId =
  | "commandCenterCeo"
  | "offersLab"
  | "ceoFinance"
  | "copyResearch"
  | "trafficAttribution"
  | "testLaboratory"
  | "commandCenter"
  | "squadSync"
  | "editorsProduction"
  | "techCro"
  | "salesRecovery"
  | "customerExperience"
  | "financeCompliance";

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
    allowedSections: [
      "commandCenterCeo",
      "offersLab",
      "ceoFinance",
      "copyResearch",
      "trafficAttribution",
      "testLaboratory",
      "commandCenter",
      "squadSync",
      "editorsProduction",
      "techCro",
      "salesRecovery",
      "customerExperience",
      "financeCompliance",
    ],
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
    allowedSections: [
      "commandCenterCeo",
      "offersLab",
      "trafficAttribution",
      "testLaboratory",
      "commandCenter",
      "squadSync",
      "techCro",
      "editorsProduction",
    ],
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
    allowedSections: [
      "commandCenterCeo",
      "offersLab",
      "copyResearch",
      "trafficAttribution",
      "testLaboratory",
      "commandCenter",
      "squadSync",
      "editorsProduction",
    ],
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
    allowedSections: [
      "commandCenterCeo",
      "offersLab",
      "trafficAttribution",
      "testLaboratory",
      "commandCenter",
      "squadSync",
      "editorsProduction",
    ],
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
  closer: {
    label: "Closer / Recovery",
    description: "Sniper list e recuperacao comercial",
    icon: Handshake,
    allowedSections: ["commandCenterCeo", "offersLab", "salesRecovery", "commandCenter", "squadSync"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: true,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: false,
    emphasizeRetention: false,
    simplifiedPerformanceView: true,
  },
  cxManager: {
    label: "Customer Experience",
    description: "Retencao, churn e LTV de pos-venda",
    icon: HeartPulse,
    allowedSections: ["commandCenterCeo", "offersLab", "customerExperience", "squadSync", "commandCenter"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: true,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: false,
    emphasizeRetention: true,
    simplifiedPerformanceView: false,
  },
  financeManager: {
    label: "Finance & Compliance",
    description: "DRE, margem e governanca legal",
    icon: ShieldCheck,
    allowedSections: ["commandCenterCeo", "offersLab", "ceoFinance", "financeCompliance", "commandCenter", "techCro"],
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
};
