import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { metrics, accounts, projects } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { validateDateString, validateAccountId } from "@/lib/security";

const VALID_TYPES = ["paying", "all"] as const;

/**
 * GET /api/metrics/customers-by-country
 *
 * Aggregates customer-by-country metrics across all data sources,
 * with blended source attribution.
 *
 * Query params:
 * - `type` — `"paying"` (default) or `"all"`. Selects which metric to query:
 *   `paying_customers_by_country` vs `new_customers_by_country`.
 * - `accountIds` — comma-separated account IDs to filter by
 * - `from` / `to` — date range (YYYY-MM-DD)
 *
 * "Blending" means: for accounts that have per-product data (projectId set),
 * we show product-level entries and drop the account-level (null projectId)
 * rows to avoid double-counting. For accounts with only account-level data,
 * we keep those rows as-is.
 *
 * This mirrors the blending logic used in the main dashboard rankings.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountIds = searchParams.get("accountIds");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type") ?? "paying";

    // ── Input validation ──
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (accountIds) {
      const ids = accountIds.split(",").filter(Boolean);
      for (const id of ids) {
        const err = validateAccountId(id);
        if (err) return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (from) {
      const err = validateDateString("from", from);
      if (err) return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (to) {
      const err = validateDateString("to", to);
      if (err) return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const db = getDb();

    // If no accountIds provided or only sentinel values, return empty data early
    // This handles both new users with no integrations AND queries without filters
    if (!accountIds || accountIds === "__none__") {
      return NextResponse.json({
        totals: [],
        bySource: [],
        accounts: {},
        projects: {},
      });
    }

    const ids = accountIds.split(",").filter(Boolean);
    const validIds = ids.filter(id => id !== "__none__" && id.trim() !== "");
    if (validIds.length === 0) {
      return NextResponse.json({
        totals: [],
        bySource: [],
        accounts: {},
        projects: {},
      });
    }

    const metricType = type === "all"
      ? "new_customers_by_country"
      : "paying_customers_by_country";

    const conditions = [eq(metrics.metricType, metricType)];

    if (accountIds) {
      const ids = accountIds.split(",").filter(Boolean);
      // Filter out sentinel values used to indicate "no accounts"
      const validIds = ids.filter(id => id !== "__none__" && id.trim() !== "");
      if (validIds.length > 0) {
        conditions.push(inArray(metrics.accountId, validIds));
      }
    }

    if (from) conditions.push(gte(metrics.date, from));
    if (to) conditions.push(lte(metrics.date, to));

    // `paying_customers_by_country` is a stock metric (point-in-time snapshot).
    // Each sync writes one snapshot per country for that day's date. Summing
    // across dates would inflate the count (same subscribers counted every day).
    // We take only the latest available date per account+project.
    //
    // `new_customers_by_country` is a flow metric (new per day). Summing across
    // the date range gives the correct total of unique new customers.
    const isStockMetric = metricType === "paying_customers_by_country";

    let rawRows: { country: string; count: number; accountId: string; projectId: string | null }[];

    if (isStockMetric) {
      const allRows = await db
        .select({
          country: sql<string>`(${metrics.metadata}->>'country')::text`.as("country"),
          value: sql<number>`CAST(${metrics.value} AS INTEGER)`.as("value"),
          accountId: metrics.accountId,
          projectId: sql<string | null>`${metrics.projectId}`.as("projectId"),
          date: metrics.date,
        })
        .from(metrics)
        .where(and(...conditions))
        .execute();

      const latestDateBySource = new Map<string, string>();
      for (const row of allRows) {
        const key = `${row.accountId}\0${row.projectId ?? ""}`;
        const cur = latestDateBySource.get(key);
        if (!cur || row.date > cur) latestDateBySource.set(key, row.date);
      }

      const agg = new Map<string, { country: string; count: number; accountId: string; projectId: string | null }>();
      for (const row of allRows) {
        const sourceKey = `${row.accountId}\0${row.projectId ?? ""}`;
        if (row.date !== latestDateBySource.get(sourceKey)) continue;

        const aggKey = `${row.country}\0${row.accountId}\0${row.projectId ?? ""}`;
        const existing = agg.get(aggKey);
        if (existing) {
          existing.count += row.value;
        } else {
          agg.set(aggKey, { country: row.country, count: row.value, accountId: row.accountId, projectId: row.projectId });
        }
      }

      rawRows = Array.from(agg.values()).sort((a, b) => b.count - a.count);
    } else {
      rawRows = await db
        .select({
          country: sql<string>`(${metrics.metadata}->>'country')::text`.as("country"),
          count: sql<number>`CAST(SUM(${metrics.value}) AS INTEGER)`.as("count"),
          accountId: metrics.accountId,
          projectId: sql<string | null>`${metrics.projectId}`.as("projectId"),
        })
        .from(metrics)
        .where(and(...conditions))
        .groupBy(
          sql`(${metrics.metadata}->>'country')::text`,
          metrics.accountId,
          metrics.projectId
        )
        .orderBy(sql`SUM(${metrics.value}) DESC`)
        .execute();
    }

    // ── Blending: identify accounts that have product-level data ──
    // If an account has ANY row with a non-null projectId, drop all its
    // account-level (null projectId) rows to avoid double-counting.
    const accountsWithProducts = new Set<string>();
    for (const row of rawRows) {
      if (row.projectId) {
        accountsWithProducts.add(row.accountId);
      }
    }

    const blendedRows = rawRows.filter(
      (row) => row.projectId !== null || !accountsWithProducts.has(row.accountId)
    );

    // ── Compute totals from blended rows ──
    const countryTotals = new Map<string, number>();
    for (const row of blendedRows) {
      countryTotals.set(row.country, (countryTotals.get(row.country) ?? 0) + row.count);
    }

    const totals = Array.from(countryTotals, ([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // ── Collect referenced IDs ──
    const refAccountIds = new Set<string>();
    const refProjectIds = new Set<string>();
    for (const row of blendedRows) {
      refAccountIds.add(row.accountId);
      if (row.projectId) refProjectIds.add(row.projectId);
    }

    // ── Batch lookups ──
    const accountLabels: Record<string, string> = {};
    if (refAccountIds.size > 0) {
      const accountRows = await db
        .select({ id: accounts.id, label: accounts.label })
        .from(accounts)
        .where(inArray(accounts.id, [...refAccountIds]))
        .execute();
      for (const row of accountRows) {
        accountLabels[row.id] = row.label;
      }
    }

    const projectLabels: Record<string, { label: string; accountId: string }> = {};
    if (refProjectIds.size > 0) {
      const projectRows = await db
        .select({ id: projects.id, label: projects.label, accountId: projects.accountId })
        .from(projects)
        .where(inArray(projects.id, [...refProjectIds]))
        .execute();
      for (const row of projectRows) {
        projectLabels[row.id] = { label: row.label, accountId: row.accountId };
      }
    }

    return NextResponse.json({
      totals,
      bySource: blendedRows,
      accounts: accountLabels,
      projects: projectLabels,
    });
  } catch (error) {
    console.error("[customers-by-country] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
