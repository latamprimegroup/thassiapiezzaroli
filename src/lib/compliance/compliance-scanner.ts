export type ComplianceStatus = "SAFE" | "MODERATE RISK" | "DANGEROUS";

export type ComplianceScanResult = {
  url: string;
  status: ComplianceStatus;
  riskScore: number;
  matchedTerms: string[];
  disclaimerRequired: boolean;
  summary: string;
};

const DANGEROUS_TERMS = [
  "cura",
  "garantido",
  "fique rico",
  "sem risco",
  "sem esforco",
  "lucro certo",
];
const MODERATE_TERMS = [
  "milagre",
  "resultado imediato",
  "transformacao instantanea",
  "seco em",
  "renda facil",
];

function sanitizeText(raw: string) {
  return raw
    .toLowerCase()
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countTerm(text: string, term: string) {
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${safe}\\b`, "gi");
  return [...text.matchAll(regex)].length;
}

function computeRiskScore(text: string) {
  const matches: string[] = [];
  let score = 0;

  for (const term of DANGEROUS_TERMS) {
    const hits = countTerm(text, term);
    if (hits > 0) {
      matches.push(term);
      score += hits * 22;
    }
  }
  for (const term of MODERATE_TERMS) {
    const hits = countTerm(text, term);
    if (hits > 0) {
      matches.push(term);
      score += hits * 12;
    }
  }

  if (text.includes("100%")) {
    matches.push("100%");
    score += 8;
  }
  if (text.includes("sem contraind")) {
    matches.push("sem contraindicao");
    score += 8;
  }

  return {
    score: Math.min(100, score),
    matches,
  };
}

function toStatus(score: number): ComplianceStatus {
  if (score >= 55) {
    return "DANGEROUS";
  }
  if (score >= 25) {
    return "MODERATE RISK";
  }
  return "SAFE";
}

export async function scanComplianceFromUrl(url: string): Promise<ComplianceScanResult> {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return {
      url: normalizedUrl,
      status: "SAFE",
      riskScore: 0,
      matchedTerms: [],
      disclaimerRequired: false,
      summary: "URL vazia.",
    };
  }

  try {
    const response = await fetch(normalizedUrl, { cache: "no-store" });
    if (!response.ok) {
      return {
        url: normalizedUrl,
        status: "MODERATE RISK",
        riskScore: 35,
        matchedTerms: ["unreachable"],
        disclaimerRequired: true,
        summary: `Falha ao acessar pagina (${response.status}). Revisar destino e compliance manual.`,
      };
    }
    const html = await response.text();
    const text = sanitizeText(html);
    const { score, matches } = computeRiskScore(text);
    const status = toStatus(score);
    const disclaimerRequired = status === "DANGEROUS";
    return {
      url: normalizedUrl,
      status,
      riskScore: score,
      matchedTerms: [...new Set(matches)].slice(0, 12),
      disclaimerRequired,
      summary:
        status === "SAFE"
          ? "Texto dentro da faixa segura para anuncios."
          : status === "MODERATE RISK"
            ? "Texto com termos sensiveis. Ajustar promessa e reforcar transparencias."
            : "Risco elevado de bloqueio. Exigir disclaimer e revisao juridica antes de escalar.",
    };
  } catch {
    return {
      url: normalizedUrl,
      status: "MODERATE RISK",
      riskScore: 30,
      matchedTerms: ["network_error"],
      disclaimerRequired: true,
      summary: "Erro de leitura da pagina. Executar revisao manual de compliance.",
    };
  }
}
