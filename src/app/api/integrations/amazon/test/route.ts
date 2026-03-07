import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import { getOAuthConfig } from "@/lib/integrations/amazon/auth";
import { AmazonSPAPIClient } from "@/lib/integrations/amazon/client";

/**
 * POST /api/integrations/amazon/test
 * 
 * Test the connection to Amazon SP-API.
 * Validates credentials and returns seller info.
 * 
 * Body:
 * - accountId: string - The account ID to test
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId } = body;

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const account = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .get();

  if (!account) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }

  if (account.integrationId !== "amazon") {
    return NextResponse.json(
      { error: "Account is not an Amazon integration" },
      { status: 400 }
    );
  }

  try {
    // Decrypt credentials
    const decrypted = JSON.parse(decrypt(account.credentials));
    const oauthConfig = getOAuthConfig();

    if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
      return NextResponse.json(
        {
          error: "Amazon OAuth not configured",
          envVars: ["AMAZON_LWA_CLIENT_ID", "AMAZON_LWA_CLIENT_SECRET"],
        },
        { status: 500 }
      );
    }

    // Create client and test connection
    const client = new AmazonSPAPIClient(oauthConfig, {
      refreshToken: decrypted.refresh_token,
      accessToken: decrypted.access_token,
      expiresAt: decrypted.access_token_expires_at
        ? parseInt(decrypted.access_token_expires_at, 10)
        : undefined,
    }, decrypted.marketplace_id || "ATVPDKIKX0DER");

    const participation = await client.getMarketplaceParticipations();

    // Extract seller info
    const sellerInfo = {
      sellerId: decrypted.selling_partner_id,
      marketplaces: participation.payload
        .filter((p) => p.participation.isParticipating)
        .map((p) => ({
          id: p.marketplace.id,
          name: p.marketplace.name,
          countryCode: p.marketplace.countryCode,
          domainName: p.marketplace.domainName,
        })),
    };

    return NextResponse.json({
      success: true,
      message: "Connection successful",
      sellerInfo,
    });
  } catch (error) {
    console.error("[Amazon] Connection test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to Amazon",
      },
      { status: 400 }
    );
  }
}
