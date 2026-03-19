import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { goals, metrics } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Calculate current value for a goal based on its metric type and period
 */
async function calculateGoalProgress(
    db: ReturnType<typeof getDb>,
    goal: typeof goals.$inferSelect
): Promise<number> {
    const { metricType, startDate, endDate } = goal;

    // Map goal metric types to actual metric types in the database
    const metricTypeMap: Record<string, string> = {
        revenue: "revenue",
        mrr: "mrr",
        sales_count: "sales_count",
        new_customers: "new_customers",
    };

    const dbMetricType = metricTypeMap[metricType];
    if (!dbMetricType) {
        return 0;
    }

    // Stock metrics (mrr) use the latest value within the period
    // Flow metrics (revenue, sales_count, new_customers) sum the values
    const isStockMetric = dbMetricType === "mrr";

    try {
        if (isStockMetric) {
            // For stock metrics, get the latest value in the period
            const result = db
                .select({
                    value: metrics.value,
                })
                .from(metrics)
                .where(
                    and(
                        eq(metrics.metricType, dbMetricType),
                        gte(metrics.date, startDate),
                        lte(metrics.date, endDate)
                    )
                )
                .orderBy(sql`${metrics.date} DESC`)
                .limit(1)
                .all();

            return result.length > 0 ? result[0].value : 0;
        } else {
            // For flow metrics, sum all values in the period
            const result = db
                .select({
                    total: sql<number>`SUM(${metrics.value})`.as("total"),
                })
                .from(metrics)
                .where(
                    and(
                        eq(metrics.metricType, dbMetricType),
                        gte(metrics.date, startDate),
                        lte(metrics.date, endDate)
                    )
                )
                .all();

            return result.length > 0 ? (result[0].total ?? 0) : 0;
        }
    } catch (error) {
        console.error(`Error calculating goal progress for ${metricType}:`, error);
        return 0;
    }
}

/**
 * POST /api/goals/sync
 * Syncs currentValue for all active goals based on actual metrics
 */
export async function POST(request: Request) {
    try {
        const db = getDb();

        // Get all active goals
        const activeGoals = await db
            .select()
            .from(goals)
            .where(eq(goals.isActive, true))
            .all();

        if (activeGoals.length === 0) {
            return NextResponse.json({ message: "No active goals to sync", synced: 0 });
        }

        // Calculate and update progress for each goal
        const results = [];
        const now = new Date().toISOString();

        for (const goal of activeGoals) {
            const currentValue = await calculateGoalProgress(db, goal);

            const updated = await db
                .update(goals)
                .set({
                    currentValue,
                    updatedAt: now,
                })
                .where(eq(goals.id, goal.id))
                .returning();

            if (updated.length > 0) {
                results.push({
                    id: goal.id,
                    name: goal.name,
                    previousValue: goal.currentValue,
                    currentValue,
                    progress: Math.min(100, (currentValue / goal.targetValue) * 100),
                });
            }
        }

        return NextResponse.json({
            message: `Synced ${results.length} goals`,
            synced: results.length,
            goals: results,
        });
    } catch (error) {
        console.error("Error syncing goals:", error);
        return NextResponse.json(
            { error: "Failed to sync goals" },
            { status: 500 }
        );
    }
}
