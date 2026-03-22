import { Pool, type PoolClient } from "pg";
import type {
  BonusPayoutApproval,
  BonusSettings,
  BonusSnapshotRow,
  MonthlyBonusPayoutRow,
  MonthlyProfitRow,
} from "@/lib/bonus/types";
import { createDefaultBonusSettings, normalizeLadderRules } from "@/lib/bonus/profit-share";

declare global {
  var __bonusDbPool: Pool | undefined;
  var __bonusDbSchemaReady: Promise<void> | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada para modulo de bonificacao.");
  }
  if (!globalThis.__bonusDbPool) {
    globalThis.__bonusDbPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return globalThis.__bonusDbPool;
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

async function ensureSchema() {
  if (!globalThis.__bonusDbSchemaReady) {
    globalThis.__bonusDbSchemaReady = (async () => {
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
        create index if not exists daily_settlements_month_idx
          on daily_settlements (settlement_date desc, user_id);

        create table if not exists bonus_manager_rules (
          user_id text primary key,
          user_name text not null default '',
          commission_pct numeric not null default 0,
          active boolean not null default true,
          updated_at timestamptz not null,
          updated_by text not null default ''
        );

        create table if not exists bonus_ladder_rules (
          id text primary key,
          min_net_profit numeric not null default 0,
          commission_pct numeric not null default 0,
          bonus_fixed numeric not null default 0,
          updated_at timestamptz not null
        );

        create table if not exists bonus_settings_meta (
          id text primary key,
          updated_at timestamptz not null,
          updated_by text not null default ''
        );

        create table if not exists bonus_monthly_snapshots (
          month_key text not null,
          user_id text not null,
          user_name text not null default '',
          niche text not null default 'geral',
          net_profit numeric not null default 0,
          commission_pct_applied numeric not null default 0,
          bonus_fixed_applied numeric not null default 0,
          commission_value numeric not null default 0,
          payout_value numeric not null default 0,
          rule_source text not null default 'ladder',
          created_at timestamptz not null,
          primary key (month_key, user_id)
        );

        create table if not exists bonus_payout_approvals (
          id text primary key,
          month_key text not null,
          approved_by text not null,
          approved_at timestamptz not null,
          note text not null default '',
          total_payout numeric not null default 0,
          payload jsonb not null default '[]'::jsonb
        );
        create index if not exists bonus_payout_approvals_month_idx
          on bonus_payout_approvals (month_key, approved_at desc);

        create or replace view bonus_monthly_profit_view as
        select
          to_char(settlement_date, 'YYYY-MM') as month_key,
          user_id,
          max(user_name) as user_name,
          coalesce((array_agg(niche order by updated_at desc))[1], 'geral') as niche,
          sum(net_profit)::numeric as net_profit,
          sum(ad_spend)::numeric as ad_spend,
          sum(gross_revenue)::numeric as gross_revenue,
          count(*)::int as days_reported
        from daily_settlements
        group by to_char(settlement_date, 'YYYY-MM'), user_id;
      `);

      const ladderCountRes = await pool.query(`select count(*)::int as count from bonus_ladder_rules`);
      const ladderCount = Number(ladderCountRes.rows[0]?.count ?? 0);
      if (ladderCount === 0) {
        const now = new Date().toISOString();
        await pool.query(
          `
          insert into bonus_ladder_rules (id, min_net_profit, commission_pct, bonus_fixed, updated_at)
          values
            ('tier-2pct', 0, 2, 0, $1::timestamptz),
            ('tier-5pct', 100000, 5, 0, $1::timestamptz),
            ('tier-7pct-bonus', 500000, 7, 10000, $1::timestamptz)
          on conflict (id) do nothing
          `,
          [now],
        );
      }
      await pool.query(
        `
        insert into bonus_settings_meta (id, updated_at, updated_by)
        values ('singleton', now(), 'system')
        on conflict (id) do nothing
        `,
      );
    })();
  }
  await globalThis.__bonusDbSchemaReady;
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

export async function readBonusSettings() {
  return withClient(async (client) => {
    const [managerRes, ladderRes, metaRes] = await Promise.all([
      client.query(`select * from bonus_manager_rules order by user_id asc`),
      client.query(`select * from bonus_ladder_rules order by min_net_profit asc`),
      client.query(`select * from bonus_settings_meta where id = 'singleton' limit 1`),
    ]);
    const settings = createDefaultBonusSettings();
    settings.managerRules = managerRes.rows.map((row) => ({
      userId: String(row.user_id),
      userName: String(row.user_name ?? ""),
      commissionPct: asNumber(row.commission_pct),
      active: Boolean(row.active),
    }));
    settings.ladderRules = normalizeLadderRules(
      ladderRes.rows.map((row) => ({
        id: String(row.id ?? ""),
        minNetProfit: asNumber(row.min_net_profit),
        commissionPct: asNumber(row.commission_pct),
        bonusFixed: asNumber(row.bonus_fixed),
      })),
    );
    const meta = metaRes.rows[0];
    settings.updatedAt = meta ? asIso(meta.updated_at) : new Date().toISOString();
    settings.updatedBy = meta ? String(meta.updated_by ?? "system") : "system";
    return settings;
  });
}

export async function writeBonusSettings(input: {
  managerRules?: BonusSettings["managerRules"];
  ladderRules?: BonusSettings["ladderRules"];
  updatedBy: string;
}) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      if (Array.isArray(input.managerRules)) {
        await client.query(`delete from bonus_manager_rules`);
        for (const rule of input.managerRules) {
          await client.query(
            `
            insert into bonus_manager_rules (user_id, user_name, commission_pct, active, updated_at, updated_by)
            values ($1, $2, $3, $4, now(), $5)
            `,
            [rule.userId, rule.userName, rule.commissionPct, rule.active, input.updatedBy],
          );
        }
      }
      if (Array.isArray(input.ladderRules)) {
        await client.query(`delete from bonus_ladder_rules`);
        const normalized = normalizeLadderRules(input.ladderRules);
        for (const rule of normalized) {
          await client.query(
            `
            insert into bonus_ladder_rules (id, min_net_profit, commission_pct, bonus_fixed, updated_at)
            values ($1, $2, $3, $4, now())
            `,
            [rule.id, rule.minNetProfit, rule.commissionPct, rule.bonusFixed],
          );
        }
      }
      await client.query(
        `
        insert into bonus_settings_meta (id, updated_at, updated_by)
        values ('singleton', now(), $1)
        on conflict (id) do update set updated_at = excluded.updated_at, updated_by = excluded.updated_by
        `,
        [input.updatedBy],
      );
      await client.query("commit");
      return readBonusSettings();
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function listMonthlyProfitRows(monthKey: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from bonus_monthly_profit_view
      where month_key = $1
      order by net_profit desc
      `,
      [monthKey],
    );
    return result.rows.map(
      (row) =>
        ({
          monthKey: String(row.month_key),
          userId: String(row.user_id),
          userName: String(row.user_name ?? row.user_id),
          niche: String(row.niche ?? "geral"),
          netProfit: asNumber(row.net_profit),
          adSpend: asNumber(row.ad_spend),
          grossRevenue: asNumber(row.gross_revenue),
          daysReported: Math.max(0, Math.round(asNumber(row.days_reported))),
        }) satisfies MonthlyProfitRow,
    );
  });
}

export async function listBonusSnapshots(monthKey: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from bonus_monthly_snapshots
      where month_key = $1
      order by payout_value desc
      `,
      [monthKey],
    );
    return result.rows.map(
      (row) =>
        ({
          monthKey: String(row.month_key),
          userId: String(row.user_id),
          userName: String(row.user_name ?? row.user_id),
          niche: String(row.niche ?? "geral"),
          netProfit: asNumber(row.net_profit),
          commissionPctApplied: asNumber(row.commission_pct_applied),
          bonusFixedApplied: asNumber(row.bonus_fixed_applied),
          commissionValue: asNumber(row.commission_value),
          payoutValue: asNumber(row.payout_value),
          ruleSource: String(row.rule_source) === "manager_override" ? "manager_override" : "ladder",
          createdAt: asIso(row.created_at),
        }) satisfies BonusSnapshotRow,
    );
  });
}

export async function insertBonusSnapshotsIfMissing(monthKey: string, rows: MonthlyBonusPayoutRow[]) {
  return withClient(async (client) => {
    const inserted: BonusSnapshotRow[] = [];
    for (const row of rows) {
      const result = await client.query(
        `
        insert into bonus_monthly_snapshots (
          month_key, user_id, user_name, niche, net_profit, commission_pct_applied, bonus_fixed_applied,
          commission_value, payout_value, rule_source, created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
        on conflict (month_key, user_id) do nothing
        returning *
        `,
        [
          monthKey,
          row.userId,
          row.userName,
          row.niche,
          row.netProfit,
          row.commissionPctApplied,
          row.bonusFixedApplied,
          row.commissionValue,
          row.payoutValue,
          row.ruleSource,
        ],
      );
      if (!result.rows[0]) {
        continue;
      }
      const created = result.rows[0];
      inserted.push({
        monthKey: String(created.month_key),
        userId: String(created.user_id),
        userName: String(created.user_name ?? created.user_id),
        niche: String(created.niche ?? "geral"),
        netProfit: asNumber(created.net_profit),
        commissionPctApplied: asNumber(created.commission_pct_applied),
        bonusFixedApplied: asNumber(created.bonus_fixed_applied),
        commissionValue: asNumber(created.commission_value),
        payoutValue: asNumber(created.payout_value),
        ruleSource: String(created.rule_source) === "manager_override" ? "manager_override" : "ladder",
        createdAt: asIso(created.created_at),
      });
    }
    return inserted;
  });
}

export async function listBonusApprovals(monthKey?: string) {
  return withClient(async (client) => {
    const result = monthKey
      ? await client.query(
          `
          select *
          from bonus_payout_approvals
          where month_key = $1
          order by approved_at desc
          `,
          [monthKey],
        )
      : await client.query(
          `
          select *
          from bonus_payout_approvals
          order by approved_at desc
          limit 500
          `,
        );
    return result.rows.map((row) => ({
      id: String(row.id),
      monthKey: String(row.month_key),
      approvedBy: String(row.approved_by),
      approvedAt: asIso(row.approved_at),
      note: String(row.note ?? ""),
      totalPayout: asNumber(row.total_payout),
      items: Array.isArray(row.payload) ? row.payload : [],
    })) as BonusPayoutApproval[];
  });
}

export async function appendBonusApproval(approval: BonusPayoutApproval) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into bonus_payout_approvals (id, month_key, approved_by, approved_at, note, total_payout, payload)
      values ($1,$2,$3,$4::timestamptz,$5,$6,$7::jsonb)
      on conflict (id) do nothing
      `,
      [
        approval.id,
        approval.monthKey,
        approval.approvedBy,
        approval.approvedAt,
        approval.note,
        approval.totalPayout,
        JSON.stringify(approval.items),
      ],
    );
    return approval;
  });
}

