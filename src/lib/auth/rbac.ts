import type { LucideIcon } from "lucide-react";
import { Clapperboard, Crown, Handshake, HeartPulse, KeyRound, PenSquare, SatelliteDish, ShieldCheck } from "lucide-react";

export type UserRole =
  | "ceo"
  | "techAdmin"
  | "ctoDev"
  | "financeManager"
  | "cfo"
  | "cco"
  | "headTraffic"
  | "sdr"
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
  | "ceoAudit"
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

export type AppRouteKey = "copy" | "traffic" | "admin";

const baseRolePermissions = {
  ceo: {
    label: "CEO (Admin)",
    description: "Visao total e aprovacao final",
    icon: Crown,
    allowedSections: [
      "commandCenterCeo",
      "ceoAudit",
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
    label: "CTO / DEV (Tech Admin)",
    description: "Integracoes, logs, health checks e tokens",
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
    label: "Financeiro / CFO",
    description: "Boardroom financeiro: custos fixos, impostos e DRE",
    icon: ShieldCheck,
    allowedSections: ["commandCenterCeo", "ceoAudit", "offersLab", "ceoFinance", "financeCompliance", "commandCenter", "techCro"],
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
  Exclude<UserRole, "mediaBuyer" | "copywriter" | "videoEditor" | "ctoDev" | "cfo" | "cco" | "headTraffic" | "sdr">,
  RolePermissions
>;

export const rolePermissions: Record<UserRole, RolePermissions> = {
  ...baseRolePermissions,
  ctoDev: {
    ...baseRolePermissions.techAdmin,
    label: "CTO / DEV",
    description: "Alias executivo para tecnologia",
  },
  cfo: {
    ...baseRolePermissions.financeManager,
    label: "CFO",
    description: "Alias executivo para financeiro",
  },
  cco: {
    ...baseRolePermissions.copySenior,
    label: "Chief Copy Officer (CCO)",
    description: "Diretor de copy para Big Idea e Mecanismo Unico",
    canApproveScaleCampaigns: true,
  },
  headTraffic: {
    ...baseRolePermissions.trafficSenior,
    label: "Head de Trafego",
    description: "Estrategia macro de budget e escala",
    canApproveScaleCampaigns: true,
  },
  sdr: {
    ...baseRolePermissions.closer,
    label: "SDR / Recuperador",
    description: "Alias comercial para Sniper List",
  },
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

const routeRoleMatrix: Record<AppRouteKey, UserRole[]> = {
  copy: ["ceo", "copyJunior", "copySenior", "copywriter", "cco"],
  traffic: ["ceo", "trafficJunior", "trafficSenior", "mediaBuyer", "headTraffic"],
  admin: ["ceo", "financeManager", "cfo", "techAdmin", "ctoDev"],
};

export function canAccessAppRoute(role: UserRole, route: AppRouteKey) {
  return routeRoleMatrix[route].includes(role);
}

export function defaultRouteForRole(role: UserRole) {
  if (canAccessAppRoute(role, "admin")) {
    return "/admin";
  }
  if (canAccessAppRoute(role, "traffic")) {
    return "/traffic";
  }
  if (canAccessAppRoute(role, "copy")) {
    return "/copy";
  }
  return "/";
}
