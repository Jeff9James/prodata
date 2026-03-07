# Plan: Adding Amazon SP-API Integration

## Overview

This document outlines the step-by-step plan to add Amazon Selling Partner API (SP-API) as a new platform integration, following the exact same pattern as Gumroad. For MVP, we only need: sales revenue, units sold, orders, products, basic daily/weekly trends, and a simple profit estimate (revenue minus estimated fees – user can input COGS later).

---

## Phase 1: Amazon SP-API Research & Setup

### 1.1 Node.js SDK Selection

**Recommended SDK:** [`@sp-api-sdk/amazon-sp-api`](https://www.npmjs.com/package/@sp-api-sdk/amazon-sp-api) or [`amazon-sp-api`](https://www.npmjs.com/package/amazon-sp-api)

This SDK handles:
- AWS Signature Version 4 signing
- SP-API authentication (LWA - Login with Amazon)
- Rate limiting
- TypeScript definitions

**Alternative:** Use official AWS SDK (`@aws-sdk/client-sp`) + manual LWA token handling if community SDKs are insufficient.

### 1.2 Required Credentials

Amazon SP-API requires a multi-step credential setup:

| Credential | Description | Source |
|------------|-------------|--------|
| `seller_id` | Seller ID from Seller Central | Seller Central dashboard |
| `client_id` | LWA client ID | SP-API Developer profile |
| `client_secret` | LWA client secret | SP-API Developer profile |
| `refresh_token` | Long-lived refresh token | OAuth flow with Amazon |
| `aws_access_key` | AWS IAM access key | AWS IAM (for signing) |
| `aws_secret_key` | AWS IAM secret key | AWS IAM |
| `aws_role_arn` | IAM role ARN | AWS IAM (role with SP-API permissions) |
| `marketplace_id` | Primary marketplace ID | Amazon marketplace (e.g., A1F83G8C2ARO7P for US) |

### 1.3 SP-API Permissions Needed

For MVP, we need the following API operations:

- **Orders API** (`orders_v0`):
  - `getOrders` — List orders by date range
  - `getOrder` — Get individual order details
  - `getOrderItems` — Get line items for an order

- **Reports API** (`reports_v2021_06_30`):
  - `createReport` — Request FBA inventory/sales report
  - `getReport` — Check report status
  - `getReportDocument` — Download report

- **Catalog Items API** (`catalogItems_v2022_04_01`):
  - `getCatalogItem` — Get product details

---

## Phase 2: New Files to Create

### Directory Structure

```
src/integrations/amazon/
├── config.ts           # ID, credentials, permissions, metric types
├── fetcher.ts          # DataFetcher implementation
├── index.ts            # Integration registration
└── __tests__/
    ├── config.test.ts  # Config tests
    └── fetcher.test.ts # Fetcher tests
```

### 2.1 `config.ts`

```typescript
// Constants
export const AMAZON_ID = "amazon";
export const AMAZON_NAME = "Amazon";
export const AMAZON_DESCRIPTION = "Connect your Amazon seller account to track sales, revenue, and orders.";
export const AMAZON_ICON = "ShoppingCart";
export const AMAZON_COLOR = "#FF9900";

// Credential fields (all required)
export const amazonCredentials: CredentialField[] = [
  {
    key: "seller_id",
    label: "Seller ID",
    type: "text",
    placeholder: "AXXXXXXXXXXXXXX",
    helpUrl: "https://sellercentral.amazon.com",
    required: true,
  },
  {
    key: "client_id",
    label: "LWA Client ID",
    type: "password",
    placeholder: "amzn1.application-oauth2-client.xxx",
    required: true,
  },
  {
    key: "client_secret",
    label: "LWA Client Secret",
    type: "password",
    placeholder: "amzn1.oa2.xxx",
    required: true,
  },
  {
    key: "refresh_token",
    label: "Refresh Token",
    type: "password",
    placeholder: "Atzr|xxx...",
    helpText: "Get this via the Amazon Developer SP-API OAuth flow",
    required: true,
  },
  {
    key: "aws_access_key",
    label: "AWS Access Key",
    type: "password",
    placeholder: "AKIA...",
    required: true,
  },
  {
    key: "aws_secret_key",
    label: "AWS Secret Key",
    type: "password",
    placeholder: "wJalrX...",
    required: true,
  },
  {
    key: "aws_role_arn",
    label: "IAM Role ARN",
    type: "text",
    placeholder: "arn:aws:iam::xxx:role/xxx",
    required: true,
  },
  {
    key: "marketplace_id",
    label: "Marketplace ID",
    type: "text",
    placeholder: "ATVPDKIKX0DER (US)",
    helpText: "Amazon marketplace ID (e.g., ATVPDKIKX0DER for US)",
    required: true,
  },
];

// Permissions (shown in UI during connection)
export const amazonPermissions: RequiredPermission[] = [
  {
    resource: "orders",
    label: "Orders",
    access: "read",
    reason: "Fetch order details to compute daily revenue, units sold, and order counts",
  },
  {
    resource: "reports",
    label: "Reports",
    access: "read",
    reason: "Access sales reports for detailed transaction data",
  },
  {
    resource: "catalog",
    label: "Catalog",
    access: "read",
    reason: "Get product information to associate sales with product names",
  },
];

// Metric types this integration provides
export const amazonMetricTypes: MetricTypeDefinition[] = [
  {
    key: "revenue",
    label: "Revenue",
    format: "currency",
    description: "Total revenue from orders (after refunds)",
  },
  {
    key: "orders_count",
    label: "Orders",
    format: "number",
    description: "Number of orders placed",
  },
  {
    key: "units_sold",
    label: "Units Sold",
    format: "number",
    description: "Total quantity of items sold",
  },
  {
    key: "new_customers",
    label: "New Customers",
    format: "number",
    description: "New buyers (first-time orders)",
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
    description: "Estimated Amazon referral fees (user can configure rate)",
  },
  {
    key: "products_count",
    label: "Products",
    format: "number",
    description: "Number of active product listings",
  },
];
```

### 2.2 `fetcher.ts`

Main implementation file. Key components:

**API Helper:**
- `amazonGet()` — Wraps SP-API calls with proper auth signing and error handling
- Token refresh handling when access token expires

**Data Fetching Steps:**
1. **Fetch Orders** — Use `getOrders` with date filter for incremental sync
2. **Fetch Order Items** — Get line item details for each order (product, qty, price)
3. **Compute Metrics** — Aggregate by day:
   - `revenue` — sum of order amounts (after refunds)
   - `orders_count` — unique order IDs
   - `units_sold` — sum of quantities
   - `refunds` — sum of refunded amounts
   - `new_customers` — count of first-time buyers (by buyer email/ID)
   - `platform_fees` — estimated at configurable % (MVP: 15% default)

**Profit Estimate:**
- Simple calculation: `revenue - (revenue * fee_rate)` 
- Fee rate stored in metadata (user-configurable in settings later)
- For MVP, hardcode to 15% Amazon referral fee + $0.30 FBA fee estimate

### 2.3 `index.ts`

```typescript
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
  dateBucketing: "utc", // Amazon uses UTC
};

registerIntegration(amazonIntegration);

export default amazonIntegration;
```

### 2.4 Registry Update

Add import in `src/integrations/registry.ts`:

```typescript
// In loadAllIntegrations()
await import("./stripe");
await import("./gumroad");
await import("./revenuecat");
await import("./amazon");  // <-- ADD THIS LINE
```

---

## Phase 3: Metric Keys (if needed)

Check [`src/integrations/metric-keys.ts`](../../src/integrations/metric-keys.ts). Existing keys should cover our MVP:

| Key | Status | Notes |
|-----|--------|-------|
| `revenue` | ✅ Exists | Use as-is |
| `sales_count` | ✅ Exists | Use for `orders_count` |
| `refunds` | ✅ Exists | Use as-is |
| `new_customers` | ✅ Exists | Use as-is |
| `products_count` | ✅ Exists | Use as-is |
| `units_sold` | ❌ Missing | **Add new key** |
| `platform_fees` | ✅ Exists | Use as-is |

### New Metric Key to Add

```typescript
// In src/integrations/metric-keys.ts, add:
units_sold: {
  key: "units_sold",
  label: "Units Sold",
  format: "number" as const,
  description: "Total quantity of items sold",
},
```

---

## Phase 4: OAuth/Auth Flow

Amazon SP-API uses OAuth 2.0 (LWA - Login with Amazon):

```
User Flow:
1. User goes to Settings → Add Amazon account
2. Dialog shows credential fields (NOT OAuth redirect)
3. User enters all 8 credential fields
4. On submit:
   a. Call validateCredentials() with all fields
   b. validateCredentials():
      - Attempt to get access token via refresh_token
      - Test API call (getOrders with minimal date range)
      - Return true if successful
5. On success: Encrypt all credentials, store in DB
```

### validateCredentials() Implementation

```typescript
async validateCredentials(credentials: Record<string, string>): Promise<boolean> {
  try {
    // 1. Exchange refresh token for access token
    const token = await getLWAToken(credentials);
    
    // 2. Test with a simple API call
    await amazonGet("/orders/v0/orders", {
      ...credentials,
      access_token: token,
      MarketplaceId: credentials.marketplace_id,
      CreatedAfter: new Date(Date.now() - 86400000).toISOString(), // Last 24h
    });
    
    return true;
  } catch (error) {
    console.error("Amazon credential validation failed:", error);
    return false;
  }
}
```

---

## Phase 5: Database Schema Changes

**No changes needed.** The existing schema fully supports Amazon:

- `accounts` table — Stores all 8 credential fields as encrypted JSON
- `metrics` table — `revenue`, `orders_count`, `units_sold`, `refunds`, `platform_fees`, `new_customers`, `products_count`
- `projects` table — Automatically created when fetcher returns metrics with `projectId` (Amazon product ASIN)

---

## Phase 6: Implementation Steps (Execution Order)

1. **Add `units_sold` to metric-keys.ts** — One-line addition
2. **Create `src/integrations/amazon/config.ts`** — Credentials, permissions, metric types
3. **Create `src/integrations/amazon/fetcher.ts`** — Main sync logic (~300 lines)
4. **Create `src/integrations/amazon/index.ts`** — Registration
5. **Update `src/integrations/registry.ts`** — Add import
6. **Write tests** — `config.test.ts`, `fetcher.test.ts` (follow Gumroad patterns)
7. **Test manually** — Add an Amazon account, run sync, verify data in dashboard

---

## Phase 7: Future Enhancements (Post-MVP)

After MVP, these can be added:

| Feature | Complexity | Notes |
|---------|------------|-------|
| FBA fees (real) | Medium | Use Reports API for FBA fee breakdowns |
| Inventory tracking | Medium | Use FBA Inventory API |
| Advertising metrics | High | Separate Amazon Ads integration |
| Multi-marketplace | Medium | Allow adding multiple marketplace_ids per account |
| COGS input | Low | Add user-configurable fee % in settings |
| Refund reason tracking | Low | Parse order item adjustment reason codes |

---

## Summary Checklist

| Item | Status |
|------|--------|
| Node.js SDK selected | ✅ `@sp-api-sdk/amazon-sp-api` or AWS SDK |
| Credential fields defined | ✅ 8 fields (seller_id, tokens, AWS keys, marketplace) |
| Files to create | ✅ 3 files (config.ts, fetcher.ts, index.ts) |
| Registry update | ✅ 1 import line |
| New metric key | ✅ `units_sold` |
| DB schema changes | ✅ None required |
| OAuth flow | ✅ Token-based (no redirect, stored refresh token) |
| Pattern matches Gumroad | ✅ Exact same structure |
