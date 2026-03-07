/**
 * Amazon SP-API client wrapper with AWS Signature V4 signing.
 */

import { format } from "date-fns";
import { createHmac, createHash } from "crypto";
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
  ATVPDKIKX0DER: "NA", // US
  A2EUQ1WTGCTBG2: "NA", // Canada
  A1AM78C64UM0Y8: "NA", // Mexico
  A1PA6795UKMFR9: "EU", // Germany
  A1F83G8C2ARO7P: "EU", // UK
  A13V1IB3VIYZZH: "EU", // France
  APJ6JRA9NG5V4: "EU", // Italy
  A1RKKUPIH5469F: "EU", // Spain
  A1VC38T7YXB528: "FE", // Japan
  A19VAU5U5O7RUS: "FE", // Singapore
  A39IBJ37TRP1C6: "FE", // Australia
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
   * Simple SHA-256 hash.
   */
  private sha256Hash(message: string): string {
    return createHash("sha256").update(message).digest("hex");
  }

  /**
   * Calculate AWS Signature Version 4 signature.
   */
  private calculateSignature(stringToSign: string, dateStamp: string): string {
    const kSecret = `AWS4${this.config.clientSecret}`;
    const kDate = createHmac("sha256", kSecret).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(this.region).digest();
    const kService = createHmac("sha256", kRegion).update("execute-api").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    return createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  }

  /**
   * Make an authenticated SP-API request.
   * Handles token refresh automatically.
   */
  async request<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    const { accessToken, refreshed } = await getValidAccessToken(
      this.config,
      this.tokens
    );

    if (refreshed) {
      console.log("[Amazon SP-API] Access token refreshed");
    }

    const baseUrl = this.getBaseUrl();
    const url = new URL(`${baseUrl}${path}`);

    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, val);
        }
      }
    }

    const now = new Date();
    const amzDate = format(now, "yyyyMMdd'T'HHmmss'Z'");
    const dateStamp = format(now, "yyyyMMdd");

    const method = "GET";
    const canonicalUri = path;
    const canonicalQuerystring = url.searchParams.toString();
    const canonicalHeaders = `host:${url.host}\nx-amz-access-token:${accessToken}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-access-token;x-amz-date";

    const payloadHash = this.sha256Hash("");
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/execute-api/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256Hash(canonicalRequest),
    ].join("\n");

    const signature = this.calculateSignature(stringToSign, dateStamp);

    const authorization = `${algorithm} Credential=${this.config.clientId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

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
