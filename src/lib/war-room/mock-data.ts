import type { WarRoomData } from "./types";

export const mockWarRoomData: WarRoomData = {
  source: "mock",
  sourceLabel: "Mock local",
  updatedAt: new Date().toISOString(),
  ads: {
    investmentTotal: 187_450,
    avgRoas: 2.14,
    avgCpm: 41.3,
    creatives: [
      { id: "CRTV-001", hookRate: 31.8, holdRate: 44.2, roas: 2.8, verdict: "Escalar" },
      { id: "CRTV-014", hookRate: 18.1, holdRate: 37.5, roas: 1.7, verdict: "Matar" },
      { id: "CRTV-026", hookRate: 23.4, holdRate: 41.6, roas: 2.3, verdict: "Escalar" },
      { id: "CRTV-031", hookRate: 16.8, holdRate: 29.7, roas: 1.4, verdict: "Matar" },
      { id: "CRTV-040", hookRate: 28.5, holdRate: 46.1, roas: 2.5, verdict: "Escalar" },
    ],
  },
  copy: {
    angles: [
      "Mecanismo unico com comparativo direto",
      "Antes x Depois orientado por resultado",
      "Quebra de objecao para publico cetico",
      "Storytelling de transformacao em 30 dias",
    ],
    hooksBacklog: [
      "Pare de fazer isso antes de subir o proximo anuncio",
      "O erro que esta drenando seu ROAS silenciosamente",
      "Como dobrar retencao sem aumentar CPM",
      "3 sinais de que seu criativo virou um zumbi de performance",
    ],
    productionFlow: {
      roteirizando: [
        "UGC: Autoridade + Prova Social",
        "Corte: Objecao de preco",
        "Oferta: Bonus relampago",
      ],
      gravando: ["Hook 7s - Dor aguda do avatar", "Demo com prova visual", "Depoimento formato selfie"],
      editando: ["Versao 15s para Reels", "Versao 45s com CTA forte", "Pacote com 5 thumb hooks"],
    },
  },
  tech: {
    pageLoadDropOff: 27.4,
    pageLoadNote: "Abandono antes de 3s. Prioridade: otimizar LCP e imagens.",
    vslRetention: 42.8,
    vslNote: "Queda acentuada no minuto 1:15. Testar hook mais agressivo no inicio.",
    checkoutConversion: 5.6,
    checkoutNote: "Upsell em +0,8pp apos simplificacao do formulario.",
  },
  finance: {
    revenue: 498_320,
    approvalRate: 86.9,
    ltv: 1_740,
  },
};
