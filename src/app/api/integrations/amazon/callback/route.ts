import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { validateOAuthState, handleOAuthCallback, getOAuthConfig } from "@/lib/integrations/amazon/auth";
import { generateSecureId } from "@/lib/security";

/**
 * GET /api/integrations/amazon/callback
 * 
 * OAuth callback handler - called after user authorizes on Amazon.
 * Exchanges the authorization code for tokens and stores the account.
 * 
 * Query params:
 * - code: string - Authorization code from Amazon
 * - state: string - State parameter for CSRF validation
 * - sellingPartnerId?: string - Seller ID (if provided by Amazon)
 * - cobrandSession?: string - Co-brand session (if applicable)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const sellingPartnerId = searchParams.get("sellingPartnerId");

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=missing_params", request.url));
  }

  // Validate OAuth state (CSRF protection)
  const oauthState = validateOAuthState(state);
  if (!oauthState) {
    return NextResponse.redirect(new URL("/settings?error=invalid_state", request.url));
  }

  const config = getOAuthConfig();

  try {
    // Exchange authorization code for tokens
    const tokens = await handleOAuthCallback(config, code);

    // Prepare credentials to store
    const credentials = {
      refresh_token: tokens.refreshToken,
      access_token: tokens.accessToken || "",
      access_token_expires_at: tokens.expiresAt?.toString() || "",
      selling_partner_id: sellingPartnerId || "",
    };

    // Encrypt credentials before storing
    const encryptedCredentials = encrypt(JSON.stringify(credentials));

    const db = getDb();
    const now = new Date().toISOString();
    const accountId = generateSecureId();

    // Store the account
    db.insert(accounts)
      .values({
        id: accountId,
        integrationId: "amazon",
        label: oauthState.label || `Amazon Seller ${sellingPartnerId?.slice(0, 8) || ""}`,
        credentials: encryptedCredentials,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    console.log(`[Amazon OAuth] Account created: ${accountId}`);

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL(`/settings?integration=amazon&status=connected`, request.url)
    );
  } catch (error) {
    console.error("[Amazon OAuth] Callback failed:", error);
    return NextResponse.redirect(
      new URL(
        `/settings?integration=amazon&error=${encodeURIComponent(
          error instanceof Error ? error.message : "OAuth failed"
        )}`,
        request.url
      )
    );
  }
}
