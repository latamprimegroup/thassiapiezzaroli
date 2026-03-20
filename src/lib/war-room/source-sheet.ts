import { normalizeWarRoomData } from "./normalize";
import type { WarRoomData } from "./types";

type SheetRecord = Record<string, string>;

function sanitizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "");
}

function rowsToObjects(values: string[][]): SheetRecord[] {
  if (values.length < 2) {
    return [];
  }

  const [headers, ...rows] = values;
  const sanitizedHeaders = headers.map(sanitizeKey);

  return rows.map((row) => {
    const record: SheetRecord = {};
    sanitizedHeaders.forEach((key, index) => {
      record[key] = (row[index] ?? "").trim();
    });
    return record;
  });
}

function pick(record: SheetRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== "") {
      return record[key];
    }
  }
  return "";
}

async function fetchSheetRange(spreadsheetId: string, apiKey: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range,
  )}?key=${apiKey}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao buscar range ${range}: ${response.status}`);
  }

  const payload = (await response.json()) as { values?: string[][] };
  return payload.values ?? [];
}

export async function loadWarRoomFromSheets(): Promise<WarRoomData> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!spreadsheetId || !apiKey) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID/GOOGLE_SHEETS_API_KEY nao configurados.");
  }

  const ranges = {
    adsMetrics: process.env.GOOGLE_SHEETS_RANGE_ADS_METRICS ?? "ads_metrics!A1:C10",
    creatives: process.env.GOOGLE_SHEETS_RANGE_CREATIVES ?? "creatives!A1:E200",
    copyAngles: process.env.GOOGLE_SHEETS_RANGE_COPY_ANGLES ?? "copy_angles!A1:A200",
    hooksBacklog: process.env.GOOGLE_SHEETS_RANGE_HOOKS_BACKLOG ?? "hooks_backlog!A1:A200",
    productionFlow: process.env.GOOGLE_SHEETS_RANGE_PRODUCTION_FLOW ?? "production_flow!A1:B200",
    techMetrics: process.env.GOOGLE_SHEETS_RANGE_TECH_METRICS ?? "tech_metrics!A1:F20",
    financeMetrics: process.env.GOOGLE_SHEETS_RANGE_FINANCE_METRICS ?? "finance_metrics!A1:C20",
  };

  const [
    adsMetricsValues,
    creativesValues,
    copyAnglesValues,
    hooksBacklogValues,
    productionFlowValues,
    techMetricsValues,
    financeMetricsValues,
  ] = await Promise.all([
    fetchSheetRange(spreadsheetId, apiKey, ranges.adsMetrics),
    fetchSheetRange(spreadsheetId, apiKey, ranges.creatives),
    fetchSheetRange(spreadsheetId, apiKey, ranges.copyAngles),
    fetchSheetRange(spreadsheetId, apiKey, ranges.hooksBacklog),
    fetchSheetRange(spreadsheetId, apiKey, ranges.productionFlow),
    fetchSheetRange(spreadsheetId, apiKey, ranges.techMetrics),
    fetchSheetRange(spreadsheetId, apiKey, ranges.financeMetrics),
  ]);

  const adsMetrics = rowsToObjects(adsMetricsValues)[0] ?? {};
  const creativesRows = rowsToObjects(creativesValues);
  const copyAnglesRows = rowsToObjects(copyAnglesValues);
  const hooksBacklogRows = rowsToObjects(hooksBacklogValues);
  const productionRows = rowsToObjects(productionFlowValues);
  const techMetrics = rowsToObjects(techMetricsValues)[0] ?? {};
  const financeMetrics = rowsToObjects(financeMetricsValues)[0] ?? {};

  const payload = {
    updatedAt: new Date().toISOString(),
    ads: {
      investmentTotal: pick(adsMetrics, ["investmenttotal", "investimentototal"]),
      avgRoas: pick(adsMetrics, ["avgroas", "roasmedio"]),
      avgCpm: pick(adsMetrics, ["avgcpm", "cpmmedio"]),
      creatives: creativesRows.map((row) => ({
        id: pick(row, ["id", "id_criativo", "idcriativo"]),
        hookRate: pick(row, ["hookrate", "hookrate(%)", "hook"]),
        holdRate: pick(row, ["holdrate", "holdrate(%)", "hold"]),
        roas: pick(row, ["roas"]),
        verdict: pick(row, ["veredict", "veredito", "verdict"]),
      })),
    },
    copy: {
      angles: copyAnglesRows.map((row) => pick(row, ["angle", "angulo", "angles"])),
      hooksBacklog: hooksBacklogRows.map((row) => pick(row, ["hook", "gancho", "hooks"])),
      productionFlow: {
        roteirizando: productionRows
          .filter((row) => pick(row, ["status"]).toLowerCase() === "roteirizando")
          .map((row) => pick(row, ["item", "tarefa", "descricao"])),
        gravando: productionRows
          .filter((row) => pick(row, ["status"]).toLowerCase() === "gravando")
          .map((row) => pick(row, ["item", "tarefa", "descricao"])),
        editando: productionRows
          .filter((row) => pick(row, ["status"]).toLowerCase() === "editando")
          .map((row) => pick(row, ["item", "tarefa", "descricao"])),
      },
    },
    tech: {
      pageLoadDropOff: pick(techMetrics, ["pageloaddropoff", "droppage", "dropload"]),
      pageLoadNote: pick(techMetrics, ["pageloadnote", "notapageload"]),
      vslRetention: pick(techMetrics, ["vslretention", "retencaovsl"]),
      vslNote: pick(techMetrics, ["vslnote", "notavsl"]),
      checkoutConversion: pick(techMetrics, ["checkoutconversion", "conversaocheckout"]),
      checkoutNote: pick(techMetrics, ["checkoutnote", "notacheckout"]),
    },
    finance: {
      revenue: pick(financeMetrics, ["revenue", "faturamentoreal", "faturamento"]),
      netRevenue: pick(financeMetrics, ["netrevenue", "faturamentoliquido", "liquido"]),
      profitMargin: pick(financeMetrics, ["profitmargin", "margem", "margemlucro"]),
      approvalRate: pick(financeMetrics, ["approvalrate", "taxaaprovacao"]),
      ltv: pick(financeMetrics, ["ltv"]),
    },
  };

  return normalizeWarRoomData(payload, "sheet", "Google Sheets");
}
