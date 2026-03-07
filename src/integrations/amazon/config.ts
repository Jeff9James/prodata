import type {
    CredentialField,
    MetricTypeDefinition,
    RequiredPermission,
} from "../types";

export const AMAZON_ID = "amazon";
export const AMAZON_NAME = "Amazon";
export const AMAZON_DESCRIPTION =
    "Connect your Amazon Seller account to track sales, revenue, and fulfillment data.";
export const AMAZON_ICON = "ShoppingCart";
export const AMAZON_COLOR = "#FF9900";

/**
 * Amazon SP-API uses OAuth with refresh tokens.
 * The Website Authorization Workflow requires:
 * 1. LWA Client ID and Client Secret (from Amazon Developer Portal)
 * 2. Seller authorizes the app → receives refresh_token
 * 3. App exchanges refresh_token for access_token on each API call
 */
export const amazonCredentials: CredentialField[] = [
    {
        key: "client_id",
        label: "LWA Client ID",
        type: "password",
        placeholder: "amzn1.application-oa2-client.xxxxxxxx",
        helpUrl: "https://developer-docs.amazon.com/sp-api/docs/creating-an-iam-policy",
        helpText:
            "Your Login with Amazon (LWA) client ID from the Amazon Developer Portal. " +
            "Create a Selling Partner API application to get these credentials.",
        required: true,
    },
    {
        key: "client_secret",
        label: "LWA Client Secret",
        type: "password",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        helpUrl: "https://developer-docs.amazon.com/sp-api/docs/creating-an-iam-policy",
        helpText:
            "Your Login with Amazon (LWA) client secret from the Amazon Developer Portal.",
        required: true,
    },
    {
        key: "refresh_token",
        label: "Refresh Token",
        type: "password",
        placeholder: "Atzr|xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        helpUrl: "https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications",
        helpText:
            "The refresh token you received after authorizing your application. " +
            "This token is used to obtain access tokens for API calls.",
        required: true,
    },
    {
        key: "seller_id",
        label: "Seller ID",
        type: "text",
        placeholder: "AXXXXXXXXXXXXXXXXX",
        helpUrl: "https://sellercentral.amazon.com",
        helpText:
            "Your Amazon Seller ID (also known as Merchant ID). " +
            "Find it in Seller Central under Settings > Account Info.",
        required: true,
    },
];

export const amazonPermissions: RequiredPermission[] = [
    {
        resource: "orders",
        label: "Orders",
        access: "read",
        reason: "Fetch order details, revenue, and sales data",
    },
    {
        resource: "catalog",
        label: "Catalog",
        access: "read",
        reason: "List products and inventory counts",
    },
    {
        resource: "finances",
        label: "Finances",
        access: "read",
        reason: "Fetch financial events, fees, and settlements",
    },
    {
        resource: "reports",
        label: "Reports",
        access: "read",
        reason: "Generate reports for sales analytics",
    },
];

export const amazonMetricTypes: MetricTypeDefinition[] = [
    {
        key: "revenue",
        label: "Revenue",
        format: "currency",
        description: "Total order revenue (before fees)",
    },
    {
        key: "orders_count",
        label: "Orders",
        format: "number",
        description: "Number of orders placed",
    },
    {
        key: "sales_count",
        label: "Units Sold",
        format: "number",
        description: "Total quantity of items sold",
    },
    {
        key: "new_customers",
        label: "New Customers",
        format: "number",
        description: "Unique first-time buyers per day",
    },
    {
        key: "refunds",
        label: "Refunds",
        format: "currency",
        description: "Total refund amount",
    },
    {
        key: "platform_fees",
        label: "Platform Fees",
        format: "currency",
        description: "Amazon referral fees and FBA fees",
    },
    {
        key: "products_count",
        label: "Products",
        format: "number",
        description: "Active product listings",
    },
];

/**
 * Amazon SP-API endpoint base URLs by region.
 * Choose the region closest to your marketplace.
 */
export const AMAZON_REGIONS = {
    "us-east-1": "https://sellingpartnerapi-na.amazon.com",
    "us-west-2": "https://sellingpartnerapi-us-west-2.amazon.com",
    "eu-west-1": "https://sellingpartnerapi-eu.amazon.com",
    "eu-central-1": "https://sellingpartnerapi-eu-central-1.amazon.com",
    "ap-northeast-1": "https://sellingpartnerapi-ap-northeast-1.amazon.com",
} as const;

export type AmazonRegion = keyof typeof AMAZON_REGIONS;

/**
 * Default region for Amazon SP-API.
 * Used when user doesn't specify a region.
 */
export const DEFAULT_AMAZON_REGION: AmazonRegion = "us-east-1";
