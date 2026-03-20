import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sales, accounts, projects } from "@/lib/db/schema";
import { eq, desc, inArray, sql, and, gte, lte } from "drizzle-orm";
import { validateAccountId, validateDateString } from "@/lib/security";

/**
 * GET /api/sales/revenue-by-country
 * 
 * Aggregates revenue data by country from sales records.
 * 
 * Query params:
 * - accountIds: Comma-separated list of account IDs to filter by
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - platform: Optional platform filter (amazon, gumroad, stripe, revenuecat)
 */
// Helper function to get country name from code
function getCountryName(code: string): string {
    if (!code || code === "Unknown") return "Unknown";
    try {
        const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
        return displayNames.of(code.toUpperCase()) || code;
    } catch {
        return code;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const accountIds = searchParams.get("accountIds");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const platform = searchParams.get("platform");

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

    const VALID_PLATFORMS = ["amazon", "gumroad", "stripe", "revenuecat"];
    if (platform && !VALID_PLATFORMS.includes(platform)) {
        return NextResponse.json(
            { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
            { status: 400 }
        );
    }

    const db = getDb();

    // If no accountIds provided or only sentinel values, return empty data early
    // This handles both new users with no integrations AND queries without filters
    if (!accountIds || accountIds === "__none__") {
        return NextResponse.json({
            totalRevenue: 0,
            totalOrders: 0,
            countries: [],
            byCountryAndPlatform: {},
        });
    }

    const ids = accountIds.split(",").filter(Boolean);
    const validIds = ids.filter(id => id !== "__none__" && id.trim() !== "");
    if (validIds.length === 0) {
        return NextResponse.json({
            totalRevenue: 0,
            totalOrders: 0,
            countries: [],
            byCountryAndPlatform: {},
        });
    }

    // Build filter conditions
    const conditions = [];
    if (accountIds) {
        const ids = accountIds.split(",").filter(Boolean);
        // Filter out sentinel values used to indicate "no accounts"
        const validIds = ids.filter(id => id !== "__none__" && id.trim() !== "");
        if (validIds.length > 0) {
            conditions.push(inArray(sales.accountId, validIds));
        }
    }
    if (from) conditions.push(gte(sales.timestamp, new Date(from)));
    if (to) conditions.push(lte(sales.timestamp, new Date(to + "T23:59:59.999Z")));
    if (platform) conditions.push(eq(sales.platform, platform));

    // Aggregate revenue by country
    const revenueByCountry = await db
        .select({
            country: sql<string | null>`${sales.country}`.as("country"),
            countryName: sales.countryName,
            totalRevenue: sql<number>`SUM(${sales.amount})`.as("totalRevenue"),
            currency: sales.currency,
            orderCount: sql<number>`COUNT(*)`.as("orderCount"),
        })
        .from(sales)
        .where(and(...conditions))
        .groupBy(sales.country, sales.countryName, sales.currency)
        .orderBy(desc(sql`SUM(${sales.amount})`))
        .execute();

    // Also get breakdown by country and platform
    const revenueByCountryAndPlatform = await db
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
        .execute();

    // Calculate totals
    const totalRevenue = revenueByCountry.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
    const totalOrders = revenueByCountry.reduce((sum, row) => sum + (row.orderCount || 0), 0);

    // Build country totals with percentages
    const countryTotals = revenueByCountry.map((row) => ({
        country: row.country || "Unknown",
        countryName: row.countryName || getCountryName(row.country || "Unknown"),
        revenue: row.totalRevenue || 0,
        orders: row.orderCount || 0,
        percentage: totalRevenue > 0 ? ((row.totalRevenue || 0) / totalRevenue) * 100 : 0,
        currency: row.currency || "USD",
    }));

    // Build platform breakdown by country
    const countryPlatformMap = new Map<string, { platform: string; revenue: number; orders: number }[]>();
    for (const row of revenueByCountryAndPlatform) {
        const countryKey = row.country || "Unknown";
        if (!countryPlatformMap.has(countryKey)) {
            countryPlatformMap.set(countryKey, []);
        }
        countryPlatformMap.get(countryKey)!.push({
            platform: row.platform,
            revenue: row.totalRevenue || 0,
            orders: row.orderCount || 0,
        });
    }

    return NextResponse.json({
        totalRevenue,
        totalOrders,
        countries: countryTotals,
        byCountryAndPlatform: Object.fromEntries(countryPlatformMap),
    });
}
