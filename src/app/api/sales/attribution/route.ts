import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sales } from "@/lib/db/schema";
import { eq, desc, inArray, sql, and, gte, lte } from "drizzle-orm";
import { validateAccountId, validateDateString } from "@/lib/security";

/**
 * GET /api/sales/attribution
 * 
 * Shows attribution summary: revenue by platform (Amazon vs Gumroad vs others)
 * optionally broken down by country or category.
 * 
 * Query params:
 * - accountIds: Comma-separated list of account IDs to filter by
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - breakdown: Optional breakdown type - "country" | "none" (default: "none")
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const accountIds = searchParams.get("accountIds");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const breakdown = searchParams.get("breakdown") || "none";

    // Input validation
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

    const VALID_BREAKDOWNS = ["country", "none"];
    if (!VALID_BREAKDOWNS.includes(breakdown)) {
        return NextResponse.json(
            { error: `Invalid breakdown. Must be one of: ${VALID_BREAKDOWNS.join(", ")}` },
            { status: 400 }
        );
    }

    const db = getDb();

    // Build filter conditions
    const conditions = [];
    if (accountIds) {
        const ids = accountIds.split(",").filter(Boolean);
        if (ids.length > 0) {
            conditions.push(inArray(sales.accountId, ids));
        }
    }
    if (from) conditions.push(gte(sales.timestamp, from));
    if (to) conditions.push(lte(sales.timestamp, to + "T23:59:59.999Z"));

    // Get overall platform attribution
    const platformAttribution = db
        .select({
            platform: sales.platform,
            totalRevenue: sql<number>`SUM(${sales.amount})`.as("totalRevenue"),
            currency: sales.currency,
            orderCount: sql<number>`COUNT(*)`.as("orderCount"),
        })
        .from(sales)
        .where(and(...conditions))
        .groupBy(sales.platform, sales.currency)
        .orderBy(desc(sql`SUM(${sales.amount})`))
        .all();

    // Calculate total revenue
    const totalRevenue = platformAttribution.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
    const totalOrders = platformAttribution.reduce((sum, row) => sum + (row.orderCount || 0), 0);

    // Build platform summary
    const platforms = platformAttribution.map((row) => ({
        platform: row.platform,
        revenue: row.totalRevenue || 0,
        orders: row.orderCount || 0,
        percentage: totalRevenue > 0 ? ((row.totalRevenue || 0) / totalRevenue) * 100 : 0,
        currency: row.currency || "USD",
    }));

    // Get breakdown by country if requested
    let countryBreakdown: Record<string, typeof platforms> = {};
    if (breakdown === "country") {
        const revenueByCountryAndPlatform = db
            .select({
                country: sql<string | null>`${sales.country}`.as("country"),
                countryName: sales.countryName,
                platform: sales.platform,
                totalRevenue: sql<number>`SUM(${sales.amount})`.as("totalRevenue"),
                currency: sales.currency,
                orderCount: sql<number>`COUNT(*)`.as("orderCount"),
            })
            .from(sales)
            .where(and(...conditions))
            .groupBy(sales.country, sales.countryName, sales.platform, sales.currency)
            .orderBy(desc(sql`SUM(${sales.amount})`))
            .all();

        // Group by country
        const countryMap = new Map<string, {
            country: string;
            countryName: string;
            platforms: { platform: string; revenue: number; orders: number; percentage: number }[];
            totalRevenue: number;
        }>();

        for (const row of revenueByCountryAndPlatform) {
            const countryKey = row.country || "Unknown";
            const countryName = row.countryName || countryKey;

            if (!countryMap.has(countryKey)) {
                countryMap.set(countryKey, {
                    country: countryKey,
                    countryName: countryName,
                    platforms: [],
                    totalRevenue: 0,
                });
            }

            const entry = countryMap.get(countryKey)!;
            const revenue = row.totalRevenue || 0;
            entry.totalRevenue += revenue;
            entry.platforms.push({
                platform: row.platform,
                revenue: revenue,
                orders: row.orderCount || 0,
                percentage: 0,
            });
        }

        // Calculate percentages for each country
        for (const [country, data] of countryMap) {
            data.platforms = data.platforms.map(p => ({
                ...p,
                percentage: data.totalRevenue > 0 ? (p.revenue / data.totalRevenue) * 100 : 0,
            })).sort((a, b) => b.revenue - a.revenue);
        }

        countryBreakdown = Object.fromEntries(countryMap);
    }

    return NextResponse.json({
        totalRevenue,
        totalOrders,
        platforms,
        breakdown: breakdown === "country" ? { type: "country", data: countryBreakdown } : { type: "none" },
    });
}
