import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { DailySettlementRecord } from "@/lib/persistence/daily-settlement-store";
import type { UserRole } from "@/lib/auth/rbac";
import { calculateEstimatedNetProfit, toDateOnlyIso } from "@/lib/metrics/daily-settlement";

type ListParams = {
  userId?: string;
  niche?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

type UpsertInput = Omit<DailySettlementRecord, "id" | "netProfit" | "createdAt" | "updatedAt">;
type IncrementSaleInput = {
  userId: string;
  userName: string;
  userRole: UserRole;
  date: string;
  niche: string;
  grossRevenueIncrement: number;
  winningCreativeId: string;
  audienceInsightAppend: string;
  productionFeedbackAppend: string;
};

declare global {
  var __dailySettlementDbPool: Pool | undefined;
  var __dailySettlementDbSchemaReady: Promise<void> | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada para Daily Settlement.");
  }
  if (!globalThis.__dailySettlementDbPool) {
    globalThis.__dailySettlementDbPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return globalThis.__dailySettlementDbPool;
}

async function ensureSchema() {
  if (!globalThis.__dailySettlementDbSchemaReady) {
    globalThis.__dailySettlementDbSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        create table if not exists daily_settlements (
          id uuid primary key,
          user_id text not null,
          user_name text not null default '',
          user_role text not null default '',
          settlement_date date not null,
          niche text not null default 'geral',
          ad_spend numeric not null default 0,
          sales_count integer not null default 0,
          gross_revenue numeric not null default 0,
          ctr numeric not null default 0,
          cpc numeric not null default 0,
          cpm numeric not null default 0,
          checkout_rate numeric not null default 0,
          winning_creative_id text not null default '',
          audience_insight text not null default '',
          production_feedback text not null default '',
          net_profit numeric not null default 0,
          created_at timestamptz not null,
          updated_at timestamptz not null
        );
        create unique index if not exists daily_settlements_user_date_unique
          on daily_settlements (user_id, settlement_date);
        create index if not exists daily_settlements_date_idx
          on daily_settlements (settlement_date desc);
        create index if not exists daily_settlements_niche_idx
          on daily_settlements (niche, settlement_date desc);
      `);
    })();
  }
  await globalThis.__dailySettlementDbSchemaReady;
}

async function withClient<T>(handler: (client: PoolClient) => Promise<T>) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

function asIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRecord(row: Record<string, unknown>): DailySettlementRecord {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    userName: String(row.user_name ?? ""),
    userRole: String(row.user_role ?? "trafficJunior") as UserRole,
    date: toDateOnlyIso(String(row.settlement_date ?? "")),
    niche: String(row.niche ?? "geral"),
    adSpend: asNumber(row.ad_spend),
    salesCount: Math.max(0, Math.round(asNumber(row.sales_count))),
    grossRevenue: asNumber(row.gross_revenue),
    ctr: asNumber(row.ctr),
    cpc: asNumber(row.cpc),
    cpm: asNumber(row.cpm),
    checkoutRate: asNumber(row.checkout_rate),
    winningCreativeId: String(row.winning_creative_id ?? ""),
    audienceInsight: String(row.audience_insight ?? ""),
    productionFeedback: String(row.production_feedback ?? ""),
    netProfit: asNumber(row.net_profit),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export async function listDailySettlements(params: ListParams = {}) {
  return withClient(async (client) => {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (params.userId) {
      values.push(params.userId);
      clauses.push(`user_id = $${values.length}`);
    }
    if (params.niche) {
      values.push(params.niche.toLowerCase());
      clauses.push(`lower(niche) = $${values.length}`);
    }
    if (params.startDate) {
      values.push(toDateOnlyIso(params.startDate));
      clauses.push(`settlement_date >= $${values.length}::date`);
    }
    if (params.endDate) {
      values.push(toDateOnlyIso(params.endDate));
      clauses.push(`settlement_date <= $${values.length}::date`);
    }

    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(10_000, Number(params.limit))) : 500;
    values.push(limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const query = `
      select *
      from daily_settlements
      ${where}
      order by settlement_date desc, updated_at desc
      limit $${values.length}
    `;
    const result = await client.query(query, values);
    return result.rows.map((row) => toRecord(row as Record<string, unknown>));
  });
}

export async function getDailySettlementByUserDate(userId: string, date: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from daily_settlements
      where user_id = $1 and settlement_date = $2::date
      limit 1
      `,
      [userId, toDateOnlyIso(date)],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toRecord(row) : null;
  });
}

export async function upsertDailySettlement(input: UpsertInput) {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    const date = toDateOnlyIso(input.date);
    const netProfit = calculateEstimatedNetProfit({
      grossRevenue: input.grossRevenue,
      adSpend: input.adSpend,
    }).netProfit;
    const idResult = await client.query(
      `
      select id
      from daily_settlements
      where user_id = $1 and settlement_date = $2::date
      limit 1
      `,
      [input.userId, date],
    );
    const id = String(idResult.rows[0]?.id ?? randomUUID());

    const result = await client.query(
      `
      insert into daily_settlements (
        id, user_id, user_name, user_role, settlement_date, niche, ad_spend, sales_count, gross_revenue, ctr, cpc, cpm,
        checkout_rate, winning_creative_id, audience_insight, production_feedback, net_profit, created_at, updated_at
      ) values (
        $1::uuid, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamptz, $19::timestamptz
      )
      on conflict (user_id, settlement_date) do update set
        user_name = excluded.user_name,
        user_role = excluded.user_role,
        niche = excluded.niche,
        ad_spend = excluded.ad_spend,
        sales_count = excluded.sales_count,
        gross_revenue = excluded.gross_revenue,
        ctr = excluded.ctr,
        cpc = excluded.cpc,
        cpm = excluded.cpm,
        checkout_rate = excluded.checkout_rate,
        winning_creative_id = excluded.winning_creative_id,
        audience_insight = excluded.audience_insight,
        production_feedback = excluded.production_feedback,
        net_profit = excluded.net_profit,
        updated_at = excluded.updated_at
      returning *
      `,
      [
        id,
        input.userId,
        input.userName,
        input.userRole,
        date,
        input.niche,
        input.adSpend,
        input.salesCount,
        input.grossRevenue,
        input.ctr,
        input.cpc,
        input.cpm,
        input.checkoutRate,
        input.winningCreativeId,
        input.audienceInsight,
        input.productionFeedback,
        netProfit,
        now,
        now,
      ],
    );
    return toRecord(result.rows[0] as Record<string, unknown>);
  });
}

export async function incrementDailySettlementSale(input: IncrementSaleInput) {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    const date = toDateOnlyIso(input.date);
    const grossIncrement = Math.max(0, Number(input.grossRevenueIncrement || 0));
    await client.query("begin");
    try {
      const locked = await client.query(
        `
        select *
        from daily_settlements
        where user_id = $1 and settlement_date = $2::date
        for update
        `,
        [input.userId, date],
      );
      if (locked.rows[0]) {
        const row = toRecord(locked.rows[0] as Record<string, unknown>);
        const nextGrossRevenue = row.grossRevenue + grossIncrement;
        const nextSalesCount = row.salesCount + 1;
        const nextAudienceInsight = [row.audienceInsight, input.audienceInsightAppend].filter(Boolean).join("\n").trim();
        const nextProductionFeedback = [row.productionFeedback, input.productionFeedbackAppend].filter(Boolean).join("\n").trim();
        const nextNet = calculateEstimatedNetProfit({
          grossRevenue: nextGrossRevenue,
          adSpend: row.adSpend,
        }).netProfit;
        const updated = await client.query(
          `
          update daily_settlements
          set user_name = $3,
              user_role = $4,
              niche = $5,
              sales_count = $6,
              gross_revenue = $7,
              winning_creative_id = $8,
              audience_insight = $9,
              production_feedback = $10,
              net_profit = $11,
              updated_at = $12::timestamptz
          where user_id = $1 and settlement_date = $2::date
          returning *
          `,
          [
            input.userId,
            date,
            input.userName || row.userName,
            input.userRole || row.userRole,
            input.niche || row.niche,
            nextSalesCount,
            nextGrossRevenue,
            input.winningCreativeId || row.winningCreativeId,
            nextAudienceInsight || row.audienceInsight,
            nextProductionFeedback || row.productionFeedback,
            nextNet,
            now,
          ],
        );
        await client.query("commit");
        return toRecord(updated.rows[0] as Record<string, unknown>);
      }

      const net = calculateEstimatedNetProfit({
        grossRevenue: grossIncrement,
        adSpend: 0,
      }).netProfit;
      const created = await client.query(
        `
        insert into daily_settlements (
          id, user_id, user_name, user_role, settlement_date, niche, ad_spend, sales_count, gross_revenue, ctr, cpc, cpm,
          checkout_rate, winning_creative_id, audience_insight, production_feedback, net_profit, created_at, updated_at
        ) values (
          $1::uuid, $2, $3, $4, $5::date, $6, 0, 1, $7, 0, 0, 0, 0, $8, $9, $10, $11, $12::timestamptz, $12::timestamptz
        )
        returning *
        `,
        [
          randomUUID(),
          input.userId,
          input.userName,
          input.userRole,
          date,
          input.niche || "geral",
          grossIncrement,
          input.winningCreativeId || "CRM-WHATSAPP",
          input.audienceInsightAppend || "Venda recuperada via Sniper CRM.",
          input.productionFeedbackAppend || "Venda recuperada via Sniper CRM.",
          net,
          now,
        ],
      );
      await client.query("commit");
      return toRecord(created.rows[0] as Record<string, unknown>);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

