import { NextResponse } from "next/server";
import {
  initiateOAuthFlow,
  getOAuthConfig,
  isOAuthConfigured,
} from "@/lib/integrations/amazon/auth";

/**
 * GET /api/integrations/amazon/connect
 * 
 * Initiates the Amazon OAuth flow (Website Authorization Workflow).
 * Redirects the user to Amazon to authorize the application.
 * 
 * Query params:
 * - label?: string - Optional label for the account
 * - marketplaceId?: string - Primary marketplace ID (for regional routing)
 */
export async function GET(request: Request) {
  // Check if OAuth is configured
  if (!isOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "Amazon OAuth is not configured. Please set environment variables.",
        envVars: [
          "AMAZON_LWA_CLIENT_ID",
          "AMAZON_LWA_CLIENT_SECRET",
          "AMAZON_APPLICATION_ID",
          "AMAZON_REDIRECT_URI",
        ],
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const label = searchParams.get("label") || undefined;

  const config = getOAuthConfig();

  try {
    const { state, authUrl } = initiateOAuthFlow(config, label);

    // Return the authorization URL so the frontend can redirect
    return NextResponse.json({
      authUrl,
      state,
      message: "Redirect to authUrl to complete Amazon authorization",
    });
  } catch (error) {
    console.error("[Amazon OAuth] Failed to initiate OAuth flow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate OAuth flow",
      },
      { status: 500 }
    );
  }
}
