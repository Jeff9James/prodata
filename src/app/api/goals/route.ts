import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
    validateLabel,
    validateNumericValue,
    validateMetricType,
    validateGoalPeriod,
    validateDateString,
    validateBoolean,
    validateUUID,
} from "@/lib/security";

/**
 * Validate goal creation/update data
 */
function validateGoalData(data: Record<string, unknown>): { errors: string[]; valid: boolean } {
    const errors: string[] = [];

    // Validate name
    const nameError = validateLabel(data.name);
    if (nameError) errors.push(nameError.message);

    // Validate targetValue
    const targetError = validateNumericValue(data.targetValue, "targetValue", 0);
    if (targetError) errors.push(targetError.message);

    // Validate metricType
    const metricError = validateMetricType(data.metricType);
    if (metricError) errors.push(metricError.message);

    // Validate period
    const periodError = validateGoalPeriod(data.period);
    if (periodError) errors.push(periodError.message);

    // Validate startDate
    const startDateError = validateDateString("startDate", data.startDate);
    if (startDateError) errors.push(startDateError.message);

    // Validate endDate
    const endDateError = validateDateString("endDate", data.endDate);
    if (endDateError) errors.push(endDateError.message);

    // Validate alertThreshold (optional, but if provided must be 0-100)
    if (data.alertThreshold !== undefined) {
        const thresholdError = validateNumericValue(data.alertThreshold, "alertThreshold", 0, 100);
        if (thresholdError) errors.push(thresholdError.message);
    }

    // Validate boolean fields
    if (data.alertEnabled !== undefined) {
        const alertEnabledError = validateBoolean("alertEnabled", data.alertEnabled);
        if (alertEnabledError) errors.push(alertEnabledError.message);
    }

    if (data.isActive !== undefined) {
        const isActiveError = validateBoolean("isActive", data.isActive);
        if (isActiveError) errors.push(isActiveError.message);
    }

    if (data.notifyOnAchieve !== undefined) {
        const notifyError = validateBoolean("notifyOnAchieve", data.notifyOnAchieve);
        if (notifyError) errors.push(notifyError.message);
    }

    return { errors, valid: errors.length === 0 };
}

export async function GET(request: Request) {
    try {
        // Get user ID from session
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get("activeOnly") === "true";
        const metricType = searchParams.get("metricType");

        // Validate metricType if provided
        if (metricType) {
            const metricError = validateMetricType(metricType);
            if (metricError) {
                return NextResponse.json({ error: metricError.message }, { status: 400 });
            }
        }

        const db = getDb();

        // Build conditions properly - always filter by userId
        const conditions = [eq(goals.userId, user.id)];
        if (activeOnly) {
            conditions.push(eq(goals.isActive, true));
        }
        if (metricType) {
            conditions.push(eq(goals.metricType, metricType));
        }

        const results = db.select().from(goals).where(and(...conditions)).execute();

        return NextResponse.json(results);
    } catch (error) {
        console.error("Error fetching goals:", error);
        return NextResponse.json(
            { error: "Failed to fetch goals" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            name,
            targetValue,
            metricType,
            period = "monthly",
            startDate,
            endDate,
            alertThreshold = 80,
            alertEnabled = true,
            isActive = true,
            notifyOnAchieve = true,
        } = body;

        // Validate required fields
        const validation = validateGoalData({
            name,
            targetValue,
            metricType,
            period,
            startDate,
            endDate,
            alertThreshold,
            alertEnabled,
            isActive,
            notifyOnAchieve,
        });

        if (!validation.valid) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.errors },
                { status: 400 }
            );
        }

        const db = getDb();
        const now = new Date().toISOString();
        // Get user ID from session
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const inserted = await db
            .insert(goals)
            .values({
                userId: user.id,
                name,
                targetValue,
                currentValue: 0,
                metricType,
                period,
                startDate,
                endDate,
                alertThreshold,
                alertEnabled,
                isActive,
                notifyOnAchieve,
                createdAt: now,
                updatedAt: now,
            } as any)
            .returning();

        return NextResponse.json(inserted[0], { status: 201 });
    } catch (error) {
        console.error("Error creating goal:", error);
        return NextResponse.json(
            { error: "Failed to create goal" },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, currentValue, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Missing required field: id" },
                { status: 400 }
            );
        }

        // Validate ID
        const idError = validateUUID(id);
        if (idError) {
            return NextResponse.json({ error: idError.message }, { status: 400 });
        }

        // Validate the update data
        if (Object.keys(updates).length > 0) {
            const validation = validateGoalData(updates);
            if (!validation.valid) {
                return NextResponse.json(
                    { error: "Validation failed", details: validation.errors },
                    { status: 400 }
                );
            }
        }

        // Validate currentValue if provided
        if (currentValue !== undefined) {
            const currentValueError = validateNumericValue(currentValue, "currentValue", 0);
            if (currentValueError) {
                return NextResponse.json({ error: currentValueError.message }, { status: 400 });
            }
        }

        const db = getDb();
        const now = new Date().toISOString();

        // If currentValue is being updated, also update the timestamp
        const updateData = {
            ...updates,
            updatedAt: now,
        };

        if (currentValue !== undefined) {
            updateData.currentValue = currentValue;
        }

        const updated = await db
            .update(goals)
            .set(updateData)
            .where(eq(goals.id, id))
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: "Goal not found" }, { status: 404 });
        }

        // Check if goal has been achieved and should trigger notification
        const goal = updated[0];
        if (
            goal.alertEnabled &&
            goal.notifyOnAchieve &&
            goal.currentValue >= goal.targetValue
        ) {
            // Goal achieved - could trigger notification here
            return NextResponse.json({
                ...goal,
                goalAchieved: true,
            });
        }

        // Check if alert threshold reached
        if (
            goal.alertEnabled &&
            goal.currentValue >= (goal.targetValue * goal.alertThreshold) / 100
        ) {
            return NextResponse.json({
                ...goal,
                alertTriggered: true,
            });
        }

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error("Error updating goal:", error);
        return NextResponse.json(
            { error: "Failed to update goal" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing required field: id" },
                { status: 400 }
            );
        }

        // Validate ID
        const idError = validateUUID(id);
        if (idError) {
            return NextResponse.json({ error: idError.message }, { status: 400 });
        }

        const db = getDb();
        const deleted = await db.delete(goals).where(eq(goals.id, id)).returning();

        if (deleted.length === 0) {
            return NextResponse.json({ error: "Goal not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting goal:", error);
        return NextResponse.json(
            { error: "Failed to delete goal" },
            { status: 500 }
        );
    }
}
