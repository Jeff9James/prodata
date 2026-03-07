/**
 * Amazon SP-API Integration
 * 
 * This module registers the Amazon Selling Partner API integration
 * with the OhMyDashboard platform.
 * 
 * The integration supports:
 * - OAuth authentication via refresh tokens
 * - Order, catalog, and financial data fetching
 * - Revenue, orders, units sold, refunds, and product metrics
 */

import { registerIntegration } from "../registry";
import type { IntegrationDefinition } from "../types";
import {
    AMAZON_ID,
    AMAZON_NAME,
    AMAZON_DESCRIPTION,
    AMAZON_ICON,
    AMAZON_COLOR,
    amazonCredentials,
    amazonMetricTypes,
    amazonPermissions,
} from "./config";
import { amazonFetcher } from "./fetcher";

const amazonIntegration: IntegrationDefinition = {
    id: AMAZON_ID,
    name: AMAZON_NAME,
    description: AMAZON_DESCRIPTION,
    icon: AMAZON_ICON,
    color: AMAZON_COLOR,
    credentials: amazonCredentials,
    metricTypes: amazonMetricTypes,
    fetcher: amazonFetcher,
    requiredPermissions: amazonPermissions,
};

registerIntegration(amazonIntegration);

export default amazonIntegration;

// Export auth helpers for OAuth flow
export {
    getAuthorizationUrl,
    exchangeCodeForTokens,
    getAccessToken,
    getSpApiEndpoint,
    validateAmazonCredentials,
} from "./auth";

export type { AmazonRegion } from "./config";
export type { LWATokenResponse } from "./auth";
