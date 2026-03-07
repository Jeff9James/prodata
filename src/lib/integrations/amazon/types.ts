/**
 * Amazon SP-API OAuth and credential types.
 */

export interface AmazonOAuthConfig {
  /** LWA Client ID from Amazon Developer Console */
  clientId: string;
  /** LWA Client Secret from Amazon Developer Console */
  clientSecret: string;
  /** Your application ID from Seller Central */
  applicationId: string;
  /** OAuth redirect URI - must match exactly what's registered in Seller Central */
  redirectUri: string;
  /** Selling Partner API endpoints - defaults to NA */
  region?: "NA" | "EU" | "FE";
}

export interface AmazonTokens {
  /** Refresh token from OAuth flow - stored for long-term use */
  refreshToken: string;
  /** Access token - expires in 1 hour, must be refreshed */
  accessToken?: string;
  /** Token expiry timestamp */
  expiresAt?: number;
}

export interface AmazonSellerInfo {
  /** Seller ID */
  sellerId: string;
  /** Seller's main marketplace country code */
  countryCode: string;
  /** Seller's registered email (if available) */
  email?: string;
  /** List of marketplace participations */
  marketplaces: Array<{
    id: string;
    countryCode: string;
    name: string;
    domainName: string;
  }>;
}

export interface OAuthState {
  /** Random state string for CSRF protection */
  state: string;
  /** Timestamp when the OAuth flow started */
  createdAt: number;
  /** Optional label user gave for this account */
  label?: string;
}

/**
 * Build the Amazon OAuth authorization URL.
 * This is the "Website Authorization Workflow" for SP-API.
 */
export function buildAuthorizationUrl(
  config: AmazonOAuthConfig,
  state: string,
  scopes?: string[]
): string {
  const defaultScopes = [
    "sellingpartner:appличese:read",
    "sellingpartner:orders:read",
    "sellingpartner:orders_v0:read",
    "sellingpartner:product:read",
    "sellingpartner:product_listings:read",
    "sellingpartner:sellers:read",
  ];

  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: (scopes || defaultScopes).join(" "),
    response_type: "code",
    redirect_uri: config.redirectUri,
    state,
  });

  return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
}

/**
 * Exchange authorization code for refresh token.
 * Called after user is redirected back from Amazon.
 */
export async function exchangeCodeForTokens(
  config: AmazonOAuthConfig,
  code: string
): Promise<AmazonTokens> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LWA token exchange failed: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshAccessToken(
  config: AmazonOAuthConfig,
  refreshToken: string
): Promise<AmazonTokens> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LWA token refresh failed: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
  };

  return {
    refreshToken: data.refresh_token || refreshToken,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
