import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sales, accounts, projects } from "@/lib/db/schema";
import { eq, desc, inArray, sql, and } from "drizzle-orm";
import { validateAccountId } from "@/lib/security";

/**
 * GET /api/sales
 * Fetch recent sales records for live feed and world map.
 *
 * Query params:
 * - limit: Number of recent sales to fetch (default: 50)
 * - accountIds: Comma-separated list of account IDs to include
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const accountIds = searchParams.get("accountIds");

        // ── Input validation ──
        if (limit < 1 || limit > 200) {
            return NextResponse.json(
                { error: "Limit must be between 1 and 200" },
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

        const db = getDb();

        // Build filter conditions
        const conditions = [];
        if (accountIds) {
            const ids = accountIds.split(",").filter(Boolean);
            if (ids.length > 0) {
                conditions.push(inArray(sales.accountId, ids));
            }
        }

        // Fetch sales records
        const saleRecords = await db
            .select({
                id: sales.id,
                accountId: sales.accountId,
                projectId: sales.projectId,
                platform: sales.platform,
                productName: sales.productName,
                productId: sales.productId,
                amount: sales.amount,
                currency: sales.currency,
                country: sales.country,
                countryName: sales.countryName,
                timestamp: sales.timestamp,
                metadata: sales.metadata,
                createdAt: sales.createdAt,
            })
            .from(sales)
            .where(and(...conditions))
            .orderBy(desc(sales.timestamp))
            .limit(limit)
            .execute();

        // Batch account and project label lookup
        const accountIdsSet = new Set<string>();
        const projectIdsSet = new Set<string>();

        for (const sale of saleRecords) {
            if (sale.accountId) {
                accountIdsSet.add(sale.accountId);
            }
            if (sale.projectId) {
                projectIdsSet.add(sale.projectId);
            }
        }

        const accountLabels: Record<string, string> = {};
        if (accountIdsSet.size > 0) {
            const accountRows = await db
                .select({ id: accounts.id, label: accounts.label })
                .from(accounts)
                .where(inArray(accounts.id, Array.from(accountIdsSet)))
                .execute();
            for (const row of accountRows) {
                accountLabels[row.id] = row.label;
            }
        }

        const projectLabels: Record<string, string> = {};
        if (projectIdsSet.size > 0) {
            const projectRows = await db
                .select({ id: projects.id, label: projects.label })
                .from(projects)
                .where(inArray(projects.id, Array.from(projectIdsSet)))
                .execute();
            for (const row of projectRows) {
                projectLabels[row.id] = row.label;
            }
        }

        // Parse metadata JSON
        const salesWithMetadata = saleRecords.map((sale) => ({
            ...sale,
            metadata: JSON.parse(sale.metadata as string),
        }));

        return NextResponse.json({
            sales: salesWithMetadata,
            accounts: accountLabels,
            projects: projectLabels,
        });
    } catch (error) {
        console.error("[sales] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
