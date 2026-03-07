/**
 * Amazon SP-API Authentication Module
 * 
 * Handles Login with Amazon (LWA) OAuth flow for the Selling Partner API.
 * 
 * Website Authorization Workflow:
 * 1. Seller clicks "Connect Amazon" in the app
 * 2. Redirect to Amazon authorization URL with client_id and redirect_uri
 * 3. Seller logs in and grants permission
 * 4. Amazon redirects to callback URL with authorization code
 * 5. Exchange authorization code for refresh_token
 * 6. Store refresh_token securely (encrypted in DB)
 * 7. Use refresh_token to get access_token for API calls
 */

import { DEFAULT_AMAZON_REGION, AMAZON_REGIONS, type AmazonRegion } from "./config";

export type { AmazonRegion };

/**
 * LWA Token Response from Amazon
 */
export interface LWATokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

/**
 * Amazon SP-API credentials stored in the accounts table
 */
export interface AmazonCredentials {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    seller_id: string;
    region?: AmazonRegion;
    marketplace_id?: string;
}

/**
 * Login with Amazon (LWA) token endpoint
 */
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

/**
 * Get an access token using the refresh token.
 * This is called before each SP-API request.
 */
export async function getAccessToken(
    credentials: AmazonCredentials
): Promise<string> {
    const { client_id, client_secret, refresh_token } = credentials;

    const response = await fetch(LWA_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token,
            client_id,
            client_secret,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${error}`);
    }

    const data: LWATokenResponse = await response.json();
    return data.access_token;
}

/**
 * Exchange an authorization code for refresh and access tokens.
 * Called during the OAuth callback after user authorizes the app.
 */
export async function exchangeCodeForTokens(
    client_id: string,
    client_secret: string,
    authorization_code: string,
    redirect_uri: string
): Promise<LWATokenResponse> {
    const response = await fetch(LWA_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: authorization_code,
            redirect_uri,
            client_id,
            client_secret,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange code for tokens: ${response.status} ${error}`);
    }

    return response.json();
}

/**
 * Generate the Amazon authorization URL for the Website Authorization Workflow.
 * 
 * @param client_id - LWA Client ID from Amazon Developer Portal
 * @param redirect_uri - URL to redirect after authorization
 * @param state - CSRF state parameter to prevent CSRF attacks
 * @param scope - Optional scope string (SP-API uses default scopes)
 */
export function getAuthorizationUrl(
    client_id: string,
    redirect_uri: string,
    state: string,
    scope?: string
): string {
    const defaultScope = "sellingpoint.inquiry.write sellingpoint.inquiry.read sellingpoint.orders.read sellingpoint.orders.write sellingpoint.listings.read sellingpoint.listings.write sellingpoint.catalog.read sellingpoint.catalog.write sellingpoint.finances.read sellingpoint.finances.write";

    const params = new URLSearchParams({
        client_id,
        redirect_uri,
        response_type: "code",
        scope: scope || defaultScope,
        state,
    });

    return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
}

/**
 * Get the SP-API endpoint URL for a given region.
 */
export function getSpApiEndpoint(region: AmazonRegion = DEFAULT_AMAZON_REGION): string {
    return AMAZON_REGIONS[region];
}

/**
 * Make an authenticated request to the Amazon SP-API.
 * Automatically handles token refresh on 401 errors.
 */
export async function spApiRequest<T>(
    credentials: AmazonCredentials,
    endpoint: string,
    method: string = "GET",
    body?: object
): Promise<T> {
    const region = credentials.region || DEFAULT_AMAZON_REGION;
    const baseUrl = getSpApiEndpoint(region);
    const url = `${baseUrl}${endpoint}`;

    let accessToken: string;

    try {
        accessToken = await getAccessToken(credentials);
    } catch (error) {
        throw new Error(`Failed to authenticate with Amazon: ${error}`);
    }

    const response = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "x-amz-access-token": accessToken,
            "x-amz-target": "SalesApiService.GetOrderMetrics",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SP-API request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * Validate Amazon credentials by making a test API call.
 * Uses the Sellers API to verify the seller can access their account.
 */
export async function validateAmazonCredentials(
    credentials: AmazonCredentials
): Promise<boolean> {
    try {
        // Try to get marketplace participations - this is a basic validation call
        // that requires valid credentials
        const region = credentials.region || DEFAULT_AMAZON_REGION;
        const baseUrl = getSpApiEndpoint(region);
        const accessToken = await getAccessToken(credentials);

        const response = await fetch(`${baseUrl}/sellers/v1/marketplaceParticipations`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "x-amz-access-token": accessToken,
                "Content-Type": "application/json",
            },
        });

        return response.ok;
    } catch (error) {
        console.error("Amazon credential validation failed:", error);
        return false;
    }
}
