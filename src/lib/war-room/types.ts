export type CreativeVerdict = "Escalar" | "Matar";

export type WarRoomData = {
  source: "mock" | "api" | "sheet" | "database" | "fallback";
  sourceLabel: string;
  updatedAt: string;
  ads: {
    investmentTotal: number;
    avgRoas: number;
    avgCpm: number;
    creatives: Array<{
      id: string;
      hookRate: number;
      holdRate: number;
      roas: number;
      verdict: CreativeVerdict;
    }>;
  };
  copy: {
    angles: string[];
    hooksBacklog: string[];
    productionFlow: {
      roteirizando: string[];
      gravando: string[];
      editando: string[];
    };
  };
  tech: {
    pageLoadDropOff: number;
    pageLoadNote: string;
    vslRetention: number;
    vslNote: string;
    checkoutConversion: number;
    checkoutNote: string;
  };
  finance: {
    revenue: number;
    approvalRate: number;
    ltv: number;
  };
};
