/**
 * Amazon SP-API OAuth authentication handler.
 * Handles the Website Authorization Workflow for SP-API.
 */

import { randomBytes } from "crypto";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  type AmazonOAuthConfig,
  type AmazonTokens,
  type OAuthState,
} from "./types";

/**
 * In-memory store for OAuth state.
 * In production, this should be persisted (DB/Redis) with TTL.
 * Maps state string -> OAuthState
 */
const oauthStateStore = new Map<string, OAuthState>();

/**
 * OAuth state TTL in seconds (10 minutes - Amazon's recommended max)
 */
const STATE_TTL_SECONDS = 600;

/**
 * Generate a new OAuth state and authorization URL.
 * Returns both the state (for validation) and the full authorization URL.
 */
export function initiateOAuthFlow(
  config: AmazonOAuthConfig,
  label?: string
): { state: string; authUrl: string } {
  // Generate cryptographically secure state string
  const state = randomBytes(32).toString("hex");

  // Store state with timestamp
  oauthStateStore.set(state, {
    state,
    createdAt: Date.now(),
    label,
  });

  // Clean up old states (older than TTL)
  cleanupExpiredStates();

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(config, state);

  return { state, authUrl };
}

/**
 * Validate the OAuth state returned from Amazon.
 * Returns the stored OAuthState if valid, or null if invalid/expired.
 */
export function validateOAuthState(state: string): OAuthState | null {
  const stored = oauthStateStore.get(state);

  if (!stored) {
    return null;
  }

  // Check if expired
  const ageSeconds = (Date.now() - stored.createdAt) / 1000;
  if (ageSeconds > STATE_TTL_SECONDS) {
    oauthStateStore.delete(state);
    return null;
  }

  // Clean up this state after validation (one-time use)
  oauthStateStore.delete(state);

  return stored;
}

/**
 * Clean up expired OAuth states from memory.
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    const ageSeconds = (now - data.createdAt) / 1000;
    if (ageSeconds > STATE_TTL_SECONDS) {
      oauthStateStore.delete(state);
    }
  }
}

/**
 * Exchange authorization code for tokens.
 */
export async function handleOAuthCallback(
  config: AmazonOAuthConfig,
  code: string
): Promise<AmazonTokens> {
  return exchangeCodeForTokens(config, code);
}

/**
 * Get a valid access token, refreshing if necessary.
 * Returns the access token and whether it was refreshed.
 */
export async function getValidAccessToken(
  config: AmazonOAuthConfig,
  tokens: AmazonTokens
): Promise<{ accessToken: string; refreshed: boolean }> {
  // Check if current access token is still valid (with 60 second buffer)
  const bufferMs = 60 * 1000;
  if (tokens.accessToken && tokens.expiresAt && tokens.expiresAt > Date.now() + bufferMs) {
    return { accessToken: tokens.accessToken, refreshed: false };
  }

  // Need to refresh
  const newTokens = await refreshAccessToken(config, tokens.refreshToken);

  return {
    accessToken: newTokens.accessToken!,
    refreshed: true,
  };
}

/**
 * Default OAuth configuration - can be overridden via environment variables.
 * These should be set in .env.local for the application.
 */
export function getOAuthConfig(): AmazonOAuthConfig {
  return {
    clientId: process.env.AMAZON_LWA_CLIENT_ID || "",
    clientSecret: process.env.AMAZON_LWA_CLIENT_SECRET || "",
    applicationId: process.env.AMAZON_APPLICATION_ID || "",
    redirectUri: process.env.AMAZON_REDIRECT_URI || "",
    region: (process.env.AMAZON_REGION as "NA" | "EU" | "FE") || "NA",
  };
}

/**
 * Check if OAuth is properly configured.
 */
export function isOAuthConfigured(): boolean {
  const config = getOAuthConfig();
  return !!(config.clientId && config.clientSecret && config.applicationId && config.redirectUri);
}
