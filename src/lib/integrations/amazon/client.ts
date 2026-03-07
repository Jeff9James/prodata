/**
 * Amazon SP-API client wrapper with AWS Signature V4 signing.
 */

import { format } from "date-fns";
import type { AmazonOAuthConfig, AmazonTokens } from "./types";
import { getValidAccessToken } from "./auth";

/**
 * SP-API endpoints by region.
 */
const SP_API_ENDPOINTS: Record<string, string> = {
  NA: "https://sellingpartnerapi-na.amazon.com",
  EU: "https://sellingpartnerapi-eu.amazon.com",
  FE: "https://sellingpartnerapi-fe.amazon.com",
};

/**
 * Marketplace ID to region mapping.
 */
const MARKETPLACE_REGIONS: Record<string, string> = {
  // North America
  ATVPDKIKX0DER: "NA", // US
  A2EUQ1WTGCTBG2: "NA", // Canada
  A1AM78C64UM0Y8: "NA", // Mexico
  A3H6H5LH9DT6ZS: "NA", // Brazil
  // Europe
  A1PA6795UKMFR9: "EU", // Germany
  A1F83G8C2ARO7P: "EU", // UK
  A13V1IB3VIYZZH: "EU", // France
  APJ6JRA9NG5V4: "EU", // Italy
  A1RKKUPIH5469F: "EU", // Spain
  A21TJRUUN4KGV: "EU", // India
  A33A1BTTW4QD5T: "EU", // Turkey
  A2V0Q9T4A0BY8Y: "EU", // UAE
  A17E79C6D8DWNP: "EU", // Saudi Arabia
  // Far East
  A1VC38T7YXB528: "FE", // Japan
  A19VAU5U5O7RUS: "FE", // Singapore
  A39IBJ37TRP1C6: "FE", // Australia
  A2Q3Y263D00KWC: "FE", // Brazil (sometimes FE)
};

/**
 * SP-API client for making authenticated requests.
 */
export class AmazonSPAPIClient {
  private config: AmazonOAuthConfig;
  private tokens: AmazonTokens;
  private region: string;

  constructor(
    config: AmazonOAuthConfig,
    tokens: AmazonTokens,
    marketplaceId: string
  ) {
    this.config = config;
    this.tokens = tokens;
    // Determine region from marketplace ID
    this.region = config.region || MARKETPLACE_REGIONS[marketplaceId] || "NA";
  }

  /**
   * Get the base URL for SP-API calls.
   */
  private getBaseUrl(): string {
    return this.config.region
      ? SP_API_ENDPOINTS[this.config.region]
      : SP_API_ENDPOINTS[this.region];
  }

  /**
   * Make an authenticated SP-API request.
   * Handles token refresh automatically.
   */
  async request<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    // Ensure we have a valid access token
    const { accessToken, refreshed } = await getValidAccessToken(
      this.config,
      this.tokens
    );

    // If token was refreshed, the caller should update their stored tokens
    if (refreshed) {
      console.log("[Amazon SP-API] Access token refreshed");
    }

    // Build the URL
    const baseUrl = this.getBaseUrl();
    const url = new URL(`${baseUrl}${path}`);

    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, val);
        }
      }
    }

    // Get current timestamp for headers
    const now = new Date();
    const amzDate = format(now, "yyyyMMdd'T'HHmmss'Z'");
    const dateStamp = format(now, "yyyyMMdd");

    // Create canonical request
    const method = "GET";
    const canonicalUri = path;
    const canonicalQuerystring = url.searchParams.toString();
    const canonicalHeaders = `host:${url.host}\nx-amz-access-token:${accessToken}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-access-token;x-amz-date";

    const payloadHash = await this.sha256Hash("");
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    // Create string to sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/execute-api/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      await this.sha256Hash(canonicalRequest),
    ].join("\n");

    // Calculate signature
    const signature = await this.calculateSignature(
      stringToSign,
      dateStamp
    );

    // Create authorization header
    const authorization = `${algorithm} Credential=${this.config.clientId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Make the request
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: authorization,
        "x-amz-access-token": accessToken,
        "x-amz-date": amzDate,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `SP-API request failed: ${response.status} ${response.statusText} - ${errorBody.slice(0, 300)}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Simple SHA-256 hash (using Web Crypto API via fetch).
   */
  private async sha256Hash(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Calculate AWS Signature Version 4 signature.
   */
  private async calculateSignature(
    stringToSign: string,
    dateStamp: string
  ): Promise<string> {
    const kSecret = new TextEncoder().encode(`AWS4${this.config.clientSecret}`);
    const kDate = await this.hmacSha256(kSecret, dateStamp);
    const kRegion = await this.hmacSha256(kDate, this.region);
    const kService = await this.hmacSha256(kRegion, "execute-api");
    const kSigning = await this.hmacSha256(kService, "aws4_request");
    const signature = await this.hmacSha256(kSigning, stringToSign);
    return this.buf2hex(signature);
  }

  /**
   * HMAC-SHA256 implementation.
   */
  private async hmacSha256(
    key: Uint8Array,
    data: string
  ): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await cryptoKey.sign(new TextEncoder().encode(data));
    return new Uint8Array(signature);
  }

  /**
   * Convert buffer to hex string.
   */
  private buf2hex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Get marketplace participations (connection test).
   */
  async getMarketplaceParticipations(): Promise<{
    payload: Array<{
      marketplace: {
        id: string;
        countryCode: string;
        name: string;
        domainName: string;
      };
      participation: {
        isParticipating: boolean;
      };
    }>;
  }> {
    return this.request("/sellers/v1/marketplaceParticipations");
  }
}

/**
 * Create an Amazon SP-API client from stored credentials.
 */
export function createAmazonClient(
  oauthConfig: AmazonOAuthConfig,
  credentials: Record<string, string>,
  marketplaceId: string
): AmazonSPAPIClient {
  const tokens: AmazonTokens = {
    refreshToken: credentials.refresh_token,
    accessToken: credentials.access_token,
    expiresAt: credentials.access_token_expires_at
      ? parseInt(credentials.access_token_expires_at, 10)
      : undefined,
  };

  return new AmazonSPAPIClient(oauthConfig, tokens, marketplaceId);
}
