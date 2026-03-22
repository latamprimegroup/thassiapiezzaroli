export type CommissionLadderRule = {
  id: string;
  minNetProfit: number;
  commissionPct: number;
  bonusFixed: number;
};

export type ManagerCommissionRule = {
  userId: string;
  userName: string;
  commissionPct: number;
  active: boolean;
};

export type BonusSettings = {
  managerRules: ManagerCommissionRule[];
  ladderRules: CommissionLadderRule[];
  updatedAt: string;
  updatedBy: string;
};

export type MonthlyProfitRow = {
  monthKey: string;
  userId: string;
  userName: string;
  niche: string;
  netProfit: number;
  adSpend: number;
  grossRevenue: number;
  daysReported: number;
};

export type MonthlyBonusPayoutRow = MonthlyProfitRow & {
  commissionPctApplied: number;
  bonusFixedApplied: number;
  commissionValue: number;
  payoutValue: number;
  ruleSource: "manager_override" | "ladder";
};

export type BonusSnapshotRow = {
  monthKey: string;
  userId: string;
  userName: string;
  niche: string;
  netProfit: number;
  commissionPctApplied: number;
  bonusFixedApplied: number;
  commissionValue: number;
  payoutValue: number;
  ruleSource: "manager_override" | "ladder";
  createdAt: string;
};

export type BonusPayoutApproval = {
  id: string;
  monthKey: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
  totalPayout: number;
  items: MonthlyBonusPayoutRow[];
};

