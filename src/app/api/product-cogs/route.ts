import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { productCogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
    validateLabel,
    validateNumericValue,
    validatePlatform,
    validateUUID,
} from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Validate product COGS creation/update data
 */
function validateCogsData(data: Record<string, unknown>): { errors: string[]; valid: boolean } {
    const errors: string[] = [];

    // Validate productName
    const nameError = validateLabel(data.productName);
    if (nameError) errors.push(nameError.message);

    // Validate productId
    if (!data.productId || typeof data.productId !== "string") {
        errors.push("productId is required and must be a string");
    }

    // Validate platform
    const platformError = validatePlatform(data.platform);
    if (platformError) errors.push(platformError.message);

    // Validate cogsAmount (optional, but if provided must be >= 0)
    if (data.cogsAmount !== undefined) {
        const cogsError = validateNumericValue(data.cogsAmount, "cogsAmount", 0);
        if (cogsError) errors.push(cogsError.message);
    }

    // Validate estimatedFeePercent (optional, but if provided must be 0-100)
    if (data.estimatedFeePercent !== undefined) {
        const feeError = validateNumericValue(data.estimatedFeePercent, "estimatedFeePercent", 0, 100);
        if (feeError) errors.push(feeError.message);
    }

    // Validate currency (optional)
    if (data.currency !== undefined && typeof data.currency !== "string") {
        errors.push("currency must be a string");
    }

    return { errors, valid: errors.length === 0 };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get("platform");
        const productId = searchParams.get("productId");

        // Validate platform if provided
        if (platform) {
            const platformError = validatePlatform(platform);
            if (platformError) {
                return NextResponse.json({ error: platformError.message }, { status: 400 });
            }
        }

        const db = getDb();

        let results;
        if (platform && productId) {
            results = await db
                .select()
                .from(productCogs)
                .where(
                    and(
                        eq(productCogs.platform, platform),
                        eq(productCogs.productId, productId)
                    )
                )
                .execute();
        } else {
            results = await db.select().from(productCogs).execute();
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("Error fetching product COGS:", error);
        return NextResponse.json(
            { error: "Failed to fetch product COGS" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            productId,
            platform,
            productName,
            cogsAmount,
            estimatedFeePercent,
            currency = "USD",
        } = body;

        // Validate required fields
        const validation = validateCogsData({
            productId,
            platform,
            productName,
            cogsAmount,
            estimatedFeePercent,
            currency,
        });

        if (!validation.valid) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.errors },
                { status: 400 }
            );
        }

        const db = getDb();
        const now = new Date();
        const id = crypto.randomUUID();

        // Check if COGS entry already exists for this product
        const existing = await db
            .select()
            .from(productCogs)
            .where(
                and(
                    eq(productCogs.platform, platform),
                    eq(productCogs.productId, productId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            // Update existing entry
            const updated = await db
                .update(productCogs)
                .set({
                    cogsAmount: cogsAmount ?? existing[0].cogsAmount,
                    estimatedFeePercent: estimatedFeePercent ?? existing[0].estimatedFeePercent,
                    currency: currency ?? existing[0].currency,
                    productName: productName ?? existing[0].productName,
                    updatedAt: now,
                })
                .where(eq(productCogs.id, existing[0].id))
                .returning();

            return NextResponse.json(updated[0]);
        }

        // Get user ID from session
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Insert new entry
        const inserted = await db
            .insert(productCogs)
            .values({
                userId: user.id,
                productId,
                platform,
                productName,
                cogsAmount: cogsAmount ?? 0,
                estimatedFeePercent: estimatedFeePercent ?? 0,
                currency,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        return NextResponse.json(inserted[0], { status: 201 });
    } catch (error) {
        console.error("Error creating/updating product COGS:", error);
        return NextResponse.json(
            { error: "Failed to create/update product COGS" },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

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
            const validation = validateCogsData(updates);
            if (!validation.valid) {
                return NextResponse.json(
                    { error: "Validation failed", details: validation.errors },
                    { status: 400 }
                );
            }
        }

        const db = getDb();
        const now = new Date().toISOString();

        const updated = await db
            .update(productCogs)
            .set({
                ...updates,
                updatedAt: now,
            })
            .where(eq(productCogs.id, id))
            .returning();

        if (updated.length === 0) {
            return NextResponse.json(
                { error: "Product COGS not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error("Error updating product COGS:", error);
        return NextResponse.json(
            { error: "Failed to update product COGS" },
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
        const deleted = await db
            .delete(productCogs)
            .where(eq(productCogs.id, id))
            .returning();

        if (deleted.length === 0) {
            return NextResponse.json(
                { error: "Product COGS not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting product COGS:", error);
        return NextResponse.json(
            { error: "Failed to delete product COGS" },
            { status: 500 }
        );
    }
}
