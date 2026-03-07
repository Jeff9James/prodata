import type {
  CredentialField,
  MetricTypeDefinition,
  RequiredPermission,
} from "../types";

export const AMAZON_ID = "amazon";
export const AMAZON_NAME = "Amazon";
export const AMAZON_DESCRIPTION =
  "Connect your Amazon Seller account to track sales, orders, and revenue from Amazon marketplaces.";
export const AMAZON_ICON = "ShoppingCart";
export const AMAZON_COLOR = "#FF9900";

export const amazonCredentials: CredentialField[] = [
  {
    key: "refresh_token",
    label: "Refresh Token",
    type: "password",
    placeholder: "Atzr|...",
    helpUrl:
      "https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications",
    helpText:
      "Generate a refresh token from Seller Central > Apps & Services > Authorize new developer. " +
      "You will need to authorize the application first.",
    required: true,
  },
  {
    key: "lwa_client_id",
    label: "LWA Client ID",
    type: "text",
    placeholder: "amzn1.application-oa2-client...",
    helpUrl:
      "https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html",
    helpText:
      "Found in your Login with Amazon security profile. Used to exchange the refresh token for an access token.",
    required: true,
  },
  {
    key: "lwa_client_secret",
    label: "LWA Client Secret",
    type: "password",
    placeholder: "...",
    helpText:
      "Found in your Login with Amazon security profile alongside the Client ID.",
    required: true,
  },
  {
    key: "aws_access_key",
    label: "AWS Access Key ID",
    type: "text",
    placeholder: "AKIA...",
    helpUrl:
      "https://developer-docs.amazon.com/sp-api/docs/creating-and-configuring-iam-policies-and-entities",
    helpText:
      "Create an IAM user with access to Selling Partner API. Found in AWS IAM > Users > Security credentials.",
    required: true,
  },
  {
    key: "aws_secret_key",
    label: "AWS Secret Access Key",
    type: "password",
    placeholder: "...",
    helpText: "Generated when creating the AWS Access Key ID above.",
    required: true,
  },
  {
    key: "marketplace_id",
    label: "Primary Marketplace ID",
    type: "text",
    placeholder: "ATVPDKIKX0DER",
    helpUrl: "https://developer-docs.amazon.com/sp-api/docs/marketplace-ids",
    helpText:
      "Your primary marketplace (e.g., ATVPDKIKX0DER for Amazon.com US, A1PA6795UKMFR9 for Amazon.de DE). " +
      "Data will be fetched from all marketplaces you participate in.",
    required: true,
  },
];

export const amazonPermissions: RequiredPermission[] = [
  {
    resource: "orders",
    label: "Orders",
    access: "read",
    reason: "Fetch order data to compute daily sales, revenue, and order counts",
  },
  {
    resource: "order_items",
    label: "Order Items",
    access: "read",
    reason: "Get detailed line items per order (price, quantity, product info)",
  },
  {
    resource: "sellers",
    label: "Seller Profile",
    access: "read",
    reason: "Verify that your credentials are valid and fetch marketplace participations",
  },
  {
    resource: "catalog",
    label: "Product Catalog",
    access: "read",
    reason: "Count active product listings",
  },
];

export const amazonMetricTypes: MetricTypeDefinition[] = [
  {
    key: "revenue",
    label: "Revenue",
    format: "currency",
    description: "Total gross revenue from Amazon orders (before fees)",
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
    description: "Total units/products sold across all orders",
  },
  {
    key: "products_count",
    label: "Active Products",
    format: "number",
    description: "Number of active product listings",
  },
  {
    key: "platform_fees",
    label: "Platform Fees",
    format: "currency",
    description: "Estimated Amazon fees (referral + FBA fees)",
  },
];
