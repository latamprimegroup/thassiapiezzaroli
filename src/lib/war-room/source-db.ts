import { Pool } from "pg";
import { normalizeWarRoomData } from "./normalize";
import type { WarRoomData } from "./types";

declare global {
  var __warRoomSourceDbPool: Pool | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada.");
  }
  if (!globalThis.__warRoomSourceDbPool) {
    globalThis.__warRoomSourceDbPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 8,
    });
  }
  return globalThis.__warRoomSourceDbPool;
}

export async function loadWarRoomFromDatabase(): Promise<WarRoomData> {
  const pool = getPool();

  try {
    const [adsMetricsRes, creativesRes, anglesRes, hooksRes, productionRes, techRes, financeRes] = await Promise.all([
      pool.query(
        "select investment_total, avg_roas, avg_cpm, updated_at from war_room_ads_metrics order by updated_at desc nulls last limit 1",
      ),
      pool.query("select id, hook_rate, hold_rate, roas, verdict from war_room_creatives"),
      pool.query("select angle from war_room_copy_angles"),
      pool.query("select hook from war_room_hooks_backlog"),
      pool.query("select status, item from war_room_production_flow"),
      pool.query(
        "select page_load_drop_off, page_load_note, vsl_retention, vsl_note, checkout_conversion, checkout_note from war_room_tech_metrics order by updated_at desc nulls last limit 1",
      ),
      pool.query("select revenue, approval_rate, ltv from war_room_finance_metrics order by updated_at desc nulls last limit 1"),
    ]);

    const adsMetrics = adsMetricsRes.rows[0] ?? {};
    const techMetrics = techRes.rows[0] ?? {};
    const financeMetrics = financeRes.rows[0] ?? {};

    const payload = {
      updatedAt:
        typeof adsMetrics.updated_at === "string"
          ? adsMetrics.updated_at
          : adsMetrics.updated_at instanceof Date
            ? adsMetrics.updated_at.toISOString()
            : new Date().toISOString(),
      ads: {
        investmentTotal: adsMetrics.investment_total,
        avgRoas: adsMetrics.avg_roas,
        avgCpm: adsMetrics.avg_cpm,
        creatives: creativesRes.rows.map((row) => ({
          id: row.id,
          hookRate: row.hook_rate,
          holdRate: row.hold_rate,
          roas: row.roas,
          verdict: row.verdict,
        })),
      },
      copy: {
        angles: anglesRes.rows.map((row) => row.angle),
        hooksBacklog: hooksRes.rows.map((row) => row.hook),
        productionFlow: {
          roteirizando: productionRes.rows.filter((row) => row.status === "Roteirizando").map((row) => row.item),
          gravando: productionRes.rows.filter((row) => row.status === "Gravando").map((row) => row.item),
          editando: productionRes.rows.filter((row) => row.status === "Editando").map((row) => row.item),
        },
      },
      tech: {
        pageLoadDropOff: techMetrics.page_load_drop_off,
        pageLoadNote: techMetrics.page_load_note,
        vslRetention: techMetrics.vsl_retention,
        vslNote: techMetrics.vsl_note,
        checkoutConversion: techMetrics.checkout_conversion,
        checkoutNote: techMetrics.checkout_note,
      },
      finance: {
        revenue: financeMetrics.revenue,
        approvalRate: financeMetrics.approval_rate,
        ltv: financeMetrics.ltv,
      },
    };

    return normalizeWarRoomData(payload, "database", "PostgreSQL");
  } finally {
    // Pool global permanece aberto para reutilizacao em ambiente serverless.
  }
}
