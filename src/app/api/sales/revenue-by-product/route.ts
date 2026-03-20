import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sales } from "@/lib/db/schema";
import { eq, desc, inArray, sql, and, gte, lte } from "drizzle-orm";
import { validateAccountId, validateDateString } from "@/lib/security";

/**
 * GET /api/sales/revenue-by-product
 * 
 * Aggregates revenue data by product from sales records.
 * Returns top 10 products with revenue trends.
 * 
 * Query params:
 * - accountIds: Comma-separated list of account IDs to filter by
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - platform: Optional platform filter (amazon, gumroad, stripe, revenuecat)
 * - limit: Number of products to return (default: 10)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const accountIds = searchParams.get("accountIds");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const platform = searchParams.get("platform");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

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

    // Build filter conditions
    const conditions = [];
    if (accountIds) {
        const ids = accountIds.split(",").filter(Boolean);
        if (ids.length > 0) {
            conditions.push(inArray(sales.accountId, ids));
        }
    }
    if (from) conditions.push(gte(sales.timestamp, new Date(from)));
    if (to) conditions.push(lte(sales.timestamp, new Date(to + "T23:59:59.999Z")));
    if (platform) conditions.push(eq(sales.platform, platform));

    // Aggregate revenue by product
    const revenueByProduct = await db
        .select({
            productName: sales.productName,
            productId: sql<string | null>`${sales.productId}`.as("productId"),
            platform: sales.platform,
            accountId: sales.accountId,
            totalRevenue: sql<number>`SUM(${sales.amount})`.as("totalRevenue"),
            currency: sales.currency,
            orderCount: sql<number>`COUNT(*)`.as("orderCount"),
        })
        .from(sales)
        .where(and(...conditions))
        .groupBy(sales.productName, sales.productId, sales.platform, sales.accountId, sales.currency)
        .orderBy(desc(sql`SUM(${sales.amount})`))
        .limit(limit)
        .execute();

    // Calculate totals
    const totalRevenue = revenueByProduct.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
    const totalOrders = revenueByProduct.reduce((sum, row) => sum + (row.orderCount || 0), 0);

    // Build product list
    const products = revenueByProduct.map((row) => ({
        productName: row.productName,
        productId: row.productId,
        platform: row.platform,
        revenue: row.totalRevenue || 0,
        orders: row.orderCount || 0,
        percentage: totalRevenue > 0 ? ((row.totalRevenue || 0) / totalRevenue) * 100 : 0,
        currency: row.currency || "USD",
    }));

    // Group by product name (across platforms)
    const productNameTotals = new Map<string, {
        productName: string;
        totalRevenue: number;
        totalOrders: number;
        platforms: string[];
    }>();

    for (const product of products) {
        const existing = productNameTotals.get(product.productName);
        if (existing) {
            existing.totalRevenue += product.revenue;
            existing.totalOrders += product.orders;
            if (!existing.platforms.includes(product.platform)) {
                existing.platforms.push(product.platform);
            }
        } else {
            productNameTotals.set(product.productName, {
                productName: product.productName,
                totalRevenue: product.revenue,
                totalOrders: product.orders,
                platforms: [product.platform],
            });
        }
    }

    // Convert to array and sort by total revenue
    const groupedProducts = Array.from(productNameTotals.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit)
        .map(p => ({
            productName: p.productName,
            revenue: p.totalRevenue,
            orders: p.totalOrders,
            percentage: totalRevenue > 0 ? (p.totalRevenue / totalRevenue) * 100 : 0,
            platforms: p.platforms,
        }));

    return NextResponse.json({
        totalRevenue,
        totalOrders,
        products,
        groupedByName: groupedProducts,
    });
}
