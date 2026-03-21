import type { LucideIcon } from "lucide-react";
import { Clapperboard, Crown, Handshake, HeartPulse, KeyRound, PenSquare, SatelliteDish, ShieldCheck } from "lucide-react";

export type UserRole =
  | "ceo"
  | "techAdmin"
  | "financeManager"
  | "copyJunior"
  | "copySenior"
  | "trafficJunior"
  | "trafficSenior"
  | "productionEditor"
  | "productionDesigner"
  | "closer"
  | "cxManager"
  | "mediaBuyer"
  | "copywriter"
  | "videoEditor";

export type SectionId =
  | "commandCenterCeo"
  | "offersLab"
  | "apiHub"
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
  canUseUtmLinkBuilder: boolean;
  canViewRetentionByVsl: boolean;
  canApproveScripts: boolean;
  canInputTrafficSpend: boolean;
  canUseScalingAdvisor: boolean;
  canManageProductionQueue: boolean;
  canAccessApiHub: boolean;
  canEditBoardroomInputs: boolean;
  canViewSystemHealthMode: boolean;
};

const baseRolePermissions = {
  ceo: {
    label: "CEO (Admin)",
    description: "Visao total e aprovacao final",
    icon: Crown,
    allowedSections: [
      "commandCenterCeo",
      "offersLab",
      "apiHub",
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
    canInputAuctionMetrics: true,
    canAlertSquad: true,
    canManageCreativeBacklog: true,
    canUploadCreativeVersions: true,
    emphasizeRetention: true,
    simplifiedPerformanceView: false,
    canUseUtmLinkBuilder: true,
    canViewRetentionByVsl: true,
    canApproveScripts: true,
    canInputTrafficSpend: true,
    canUseScalingAdvisor: true,
    canManageProductionQueue: true,
    canAccessApiHub: true,
    canEditBoardroomInputs: true,
    canViewSystemHealthMode: true,
  },
  techAdmin: {
    label: "Tech Admin",
    description: "Integracoes, tokens e saude de dados",
    icon: KeyRound,
    allowedSections: ["commandCenterCeo", "apiHub", "techCro", "financeCompliance", "commandCenter"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: true,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: false,
    emphasizeRetention: false,
    simplifiedPerformanceView: false,
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: true,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: true,
  },
  financeManager: {
    label: "Financeiro",
    description: "Boardroom financeiro: custos fixos, impostos e DRE",
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
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: true,
    canViewSystemHealthMode: true,
  },
  copyJunior: {
    label: "Squad Copy (Junior)",
    description: "Input de hooks e gerador de UTM pre-aprovada",
    icon: PenSquare,
    allowedSections: ["commandCenterCeo", "copyResearch", "squadSync", "editorsProduction"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: false,
    canManageCreativeBacklog: true,
    canUploadCreativeVersions: false,
    emphasizeRetention: true,
    simplifiedPerformanceView: false,
    canUseUtmLinkBuilder: true,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: false,
  },
  copySenior: {
    label: "Squad Copy (Senior)",
    description: "Retencao por VSL, aprovacao de roteiro e Vault",
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
    canUseUtmLinkBuilder: true,
    canViewRetentionByVsl: true,
    canApproveScripts: true,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: false,
  },
  trafficJunior: {
    label: "Squad Trafego (Junior)",
    description: "Input diario de gastos por plataforma",
    icon: SatelliteDish,
    allowedSections: ["commandCenterCeo", "offersLab", "trafficAttribution", "squadSync", "editorsProduction"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: true,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: true,
    canAlertSquad: true,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: false,
    emphasizeRetention: false,
    simplifiedPerformanceView: false,
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: true,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: true,
  },
  trafficSenior: {
    label: "Squad Trafego (Senior)",
    description: "Scaling advisor e decisao de escala",
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
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: true,
    canUseScalingAdvisor: true,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: true,
  },
  productionEditor: {
    label: "Squad Producao (Editor)",
    description: "Fila de producao e upload do criativo final",
    icon: Clapperboard,
    allowedSections: ["commandCenterCeo", "offersLab", "trafficAttribution", "commandCenter", "testLaboratory", "squadSync", "editorsProduction"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: false,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: true,
    emphasizeRetention: true,
    simplifiedPerformanceView: true,
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: true,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: true,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: false,
  },
  productionDesigner: {
    label: "Squad Producao (Designer)",
    description: "Fila de assets e entregas visuais",
    icon: Clapperboard,
    allowedSections: ["commandCenterCeo", "commandCenter", "squadSync", "editorsProduction", "testLaboratory"],
    canViewSensitiveFinancials: false,
    canViewRoasReal: false,
    canApproveScaleCampaigns: false,
    canInputAuctionMetrics: false,
    canAlertSquad: false,
    canManageCreativeBacklog: false,
    canUploadCreativeVersions: true,
    emphasizeRetention: true,
    simplifiedPerformanceView: true,
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: true,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: true,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: false,
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
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: false,
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
    canUseUtmLinkBuilder: false,
    canViewRetentionByVsl: false,
    canApproveScripts: false,
    canInputTrafficSpend: false,
    canUseScalingAdvisor: false,
    canManageProductionQueue: false,
    canAccessApiHub: false,
    canEditBoardroomInputs: false,
    canViewSystemHealthMode: false,
  },
} satisfies Record<
  Exclude<UserRole, "mediaBuyer" | "copywriter" | "videoEditor">,
  RolePermissions
>;

export const rolePermissions: Record<UserRole, RolePermissions> = {
  ...baseRolePermissions,
  mediaBuyer: {
    ...baseRolePermissions.trafficSenior,
    label: "Media Buyer (Legacy)",
    description: "Alias para Squad Trafego (Senior)",
  },
  copywriter: {
    ...baseRolePermissions.copySenior,
    label: "Copywriter (Legacy)",
    description: "Alias para Squad Copy (Senior)",
  },
  videoEditor: {
    ...baseRolePermissions.productionEditor,
    label: "Video Editor (Legacy)",
    description: "Alias para Squad Producao (Editor)",
  },
};
