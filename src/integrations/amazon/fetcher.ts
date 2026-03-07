import { format, subDays, startOfDay } from "date-fns";
import type {
  AccountConfig,
  DataFetcher,
  NormalizedMetric,
  SyncResult,
  SyncStep,
} from "../types";

// ─── Amazon SP-API types ────────────────────────────────────────────────────

/**
 * Amazon SP-API base URLs by region.
 * North America: sellingpartnerapi-na.amazon.com
 * Europe: sellingpartnerapi-eu.amazon.com
 * Far East: sellingpartnerapi-fe.amazon.com
 */
const SP_API_ENDPOINTS: Record<string, string> = {
  NA: "https://sellingpartnerapi-na.amazon.com",
  EU: "https://sellingpartnerapi-eu.amazon.com",
  FE: "https://sellingpartnerapi-fe.amazon.com",
};

/**
 * Marketplace ID to region mapping for endpoint selection
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

interface AmazonCredentials {
  refresh_token: string;
  lwa_client_id: string;
  lwa_client_secret: string;
  aws_access_key: string;
  aws_secret_key: string;
  marketplace_id: string;
}

interface LwaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface MarketplaceParticipation {
  marketplace: {
    id: string;
    countryCode: string;
    name: string;
    defaultCurrencyCode: string;
    defaultLanguageCode: string;
    domainName: string;
  };
  participation: {
    isParticipating: boolean;
    hasSuspendedListings: boolean;
  };
}

interface AmazonOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  LastUpdateDate: string;
  OrderStatus: string;
  FulfillmentChannel: string;
  SalesChannel: string;
  OrderChannel?: string;
  ShipServiceLevel: string;
  Total: {
    CurrencyCode: string;
    Amount: string;
  };
  NumberOfItemsShipped?: number;
  NumberOfItemsUnshipped?: number;
  PaymentMethod?: string;
  PaymentMethodDetails?: string[];
  MarketplaceId: string;
  ShipmentServiceLevelCategory?: string;
  OrderType?: string;
  EarliestShipDate?: string;
  LatestShipDate?: string;
  EarliestDeliveryDate?: string;
  LatestDeliveryDate?: string;
  IsBusinessOrder?: boolean;
  IsPrime?: boolean;
  IsGlobalExpressEnabled?: boolean;
  IsPremiumOrder?: boolean;
  IsSoldByAB?: boolean;
  IsIBA?: boolean;
}

interface OrderItem {
  OrderItemId: string;
  ASIN: string;
  SKU?: string;
  Title: string;
  QuantityOrdered: number;
  QuantityShipped?: number;
  ItemPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  ShippingPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  ItemTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  ShippingTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  ShippingDiscount?: {
    CurrencyCode: string;
    Amount: string;
  };
  PromotionDiscount?: {
    CurrencyCode: string;
    Amount: string;
  };
  Commission?: {
    CurrencyCode: string;
    Amount: string;
  };
}

// ─── API helpers ─────────────────────────────────────────────────────────────

/**
 * Get the SP-API endpoint based on marketplace ID
 */
function getEndpoint(marketplaceId: string): string {
  const region = MARKETPLACE_REGIONS[marketplaceId] || "NA";
  return SP_API_ENDPOINTS[region];
}

/**
 * Exchange refresh token for access token via Login with Amazon (LWA)
 */
async function getAccessToken(
  credentials: AmazonCredentials
): Promise<string> {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", credentials.refresh_token);
  params.append("client_id", credentials.lwa_client_id);
  params.append("client_secret", credentials.lwa_client_secret);

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LWA token error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as LwaTokenResponse;
  return data.access_token;
}

/**
 * Sign request with AWS Signature Version 4
 * Simplified implementation - in production use aws4 or @aws-sdk/signature-v4
 */
async function signedFetch(
  url: string,
  options: RequestInit,
  _credentials: AmazonCredentials,
  accessToken: string
): Promise<Response> {
  // Get current timestamp
  const now = new Date();
  const amzDate = format(now, "yyyyMMdd'T'HHmmss'Z'");

  // For MVP, we'll use a simpler approach with the access token
  // Full AWS SigV4 implementation would require crypto for signing
  const headers: Record<string, string> = {
    "x-amz-access-token": accessToken,
    "x-amz-date": amzDate,
    ...(options.headers as Record<string, string> || {}),
  };

  // Note: Full AWS Signature V4 requires complex signing with the AWS credentials
  // For production, use a proper library like aws4 or the official SDK

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make authenticated SP-API request
 */
async function spApiGet<T>(
  path: string,
  credentials: AmazonCredentials,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const baseUrl = getEndpoint(credentials.marketplace_id);
  const url = new URL(`${baseUrl}${path}`);

  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, val);
      }
    }
  }

  const res = await signedFetch(
    url.toString(),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
    credentials,
    accessToken
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SP-API error ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

/**
 * Fetch marketplace participations to validate credentials and get currency
 */
async function fetchMarketplaceParticipations(
  credentials: AmazonCredentials,
  accessToken: string
): Promise<MarketplaceParticipation[]> {
  const data = await spApiGet<{ payload: MarketplaceParticipation[] }>(
    "/sellers/v1/marketplaceParticipations",
    credentials,
    accessToken
  );
  return data.payload || [];
}

/**
 * Fetch orders within a date range, handling pagination
 */
async function fetchOrders(
  credentials: AmazonCredentials,
  accessToken: string,
  since: Date,
  reportStep?: (step: SyncStep) => void
): Promise<AmazonOrder[]> {
  const orders: AmazonOrder[] = [];
  const createdAfter = since.toISOString();
  let nextToken: string | undefined;

  // Fetch from all participating marketplaces
  const participations = await fetchMarketplaceParticipations(
    credentials,
    accessToken
  );
  const marketplaceIds = participations
    .filter((p) => p.participation.isParticipating)
    .map((p) => p.marketplace.id)
    .join(",");

  while (true) {
    const params: Record<string, string> = {
      CreatedAfter: createdAfter,
      MarketplaceIds: marketplaceIds || credentials.marketplace_id,
      OrderStatuses: "Unshipped,PartiallyShipped,Shipped,InvoiceUnconfirmed,Pending",
    };

    if (nextToken) {
      params.NextToken = nextToken;
    }

    const data = await spApiGet<{
      payload?: { Orders?: AmazonOrder[] };
      nextToken?: string;
      errors?: Array<{ message: string }>;
    }>("/orders/v0/orders", credentials, accessToken, params);

    if (data.errors && data.errors.length > 0) {
      throw new Error(`SP-API orders error: ${data.errors[0].message}`);
    }

    if (data.payload?.Orders) {
      orders.push(...data.payload.Orders);
      reportStep?.({
        key: "fetch_orders",
        label: "Fetch orders",
        status: "running",
        recordCount: orders.length,
      });
    }

    nextToken = data.nextToken;
    if (!nextToken) {
      break;
    }

    // Rate limiting: max 20 requests per second for Orders API
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  return orders;
}

/**
 * Fetch order items for a specific order
 */
async function fetchOrderItems(
  orderId: string,
  credentials: AmazonCredentials,
  accessToken: string
): Promise<OrderItem[]> {
  const data = await spApiGet<{
    payload?: { OrderItems?: OrderItem[] };
    errors?: Array<{ message: string }>;
  }>(`/orders/v0/orders/${orderId}/orderItems`, credentials, accessToken);

  if (data.errors && data.errors.length > 0) {
    throw new Error(`SP-API order items error: ${data.errors[0].message}`);
  }

  return data.payload?.OrderItems || [];
}

// ─── Metric computation ──────────────────────────────────────────────────────

/**
 * Compute daily revenue, orders, and units sold from order data
 */
async function computeOrderMetrics(
  orders: AmazonOrder[],
  credentials: AmazonCredentials,
  accessToken: string,
  reportStep?: (step: SyncStep) => void
): Promise<{
  metrics: NormalizedMetric[];
  asinsWithSales: Set<string>;
}> {
  // Group orders by date
  const ordersByDate = new Map<
    string,
    {
      orders: AmazonOrder[];
      totalRevenue: number;
      currency: string;
    }
  >();

  const asinsWithSales = new Set<string>();
  let processedItems = 0;

  reportStep?.({
    key: "fetch_order_items",
    label: "Fetch order items",
    status: "running",
  });

  for (const order of orders) {
    // Skip cancelled orders
    if (order.OrderStatus === "Canceled") continue;

    const date = format(new Date(order.PurchaseDate), "yyyy-MM-dd");
    const currency = order.Total.CurrencyCode || "USD";

    if (!ordersByDate.has(date)) {
      ordersByDate.set(date, { orders: [], totalRevenue: 0, currency });
    }

    const dayData = ordersByDate.get(date)!;
    dayData.orders.push(order);

    // Get order items for accurate revenue (order total may include shipping/tax we don't want)
    try {
      const items = await fetchOrderItems(
        order.AmazonOrderId,
        credentials,
        accessToken
      );

      let orderRevenue = 0;
      for (const item of items) {
        const itemPrice = parseFloat(item.ItemPrice?.Amount || "0");
        const shippingPrice = parseFloat(item.ShippingPrice?.Amount || "0");
        const promotionDiscount = parseFloat(
          item.PromotionDiscount?.Amount || "0"
        );
        const shippingDiscount = parseFloat(
          item.ShippingDiscount?.Amount || "0"
        );

        // Net revenue for this item
        const itemRevenue =
          itemPrice +
          shippingPrice -
          promotionDiscount -
          shippingDiscount;
        orderRevenue += Math.max(0, itemRevenue);

        if (item.ASIN) {
          asinsWithSales.add(item.ASIN);
        }
      }

      dayData.totalRevenue += orderRevenue;
      processedItems += items.length;

      // Report progress every 10 orders
      if (processedItems % 10 === 0) {
        reportStep?.({
          key: "fetch_order_items",
          label: "Fetch order items",
          status: "running",
          recordCount: processedItems,
        });
      }

      // Rate limiting between order item requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      // Fall back to order total if order items fail
      const orderTotal = parseFloat(order.Total.Amount || "0");
      dayData.totalRevenue += orderTotal;
    }
  }

  reportStep?.({
    key: "fetch_order_items",
    label: "Fetch order items",
    status: "success",
    recordCount: processedItems,
  });

  // Convert to normalized metrics
  const metrics: NormalizedMetric[] = [];

  for (const [date, data] of ordersByDate) {
    // Revenue metric
    metrics.push({
      metricType: "revenue",
      value: Math.round(data.totalRevenue * 100) / 100,
      currency: data.currency,
      date,
    });

    // Orders count
    metrics.push({
      metricType: "orders_count",
      value: data.orders.length,
      date,
    });

    // Estimate units sold (ItemsShipped + ItemsUnshipped)
    const unitsSold = data.orders.reduce((sum, order) => {
      const shipped = order.NumberOfItemsShipped || 0;
      const unshipped = order.NumberOfItemsUnshipped || 0;
      return sum + shipped + unshipped;
    }, 0);

    metrics.push({
      metricType: "sales_count",
      value: unitsSold,
      date,
    });

    // Estimated platform fees (~15% referral fee + FBA)
    const estimatedFees = data.totalRevenue * 0.15;
    metrics.push({
      metricType: "platform_fees",
      value: Math.round(estimatedFees * 100) / 100,
      currency: data.currency,
      date,
      metadata: { fee_source: "amazon", estimated: "true" },
    });
  }

  return { metrics, asinsWithSales };
}

/**
 * Fetch and count active products
 * For MVP, we use the count of ASINs that had sales
 */
function computeProductsCount(
  asinsWithSales: Set<string>,
  today: string
): NormalizedMetric[] {
  return [
    {
      metricType: "products_count",
      value: asinsWithSales.size,
      date: today,
    },
  ];
}

// ─── DataFetcher implementation ──────────────────────────────────────────────

/**
 * Amazon SP-API data fetcher
 */
export const amazonFetcher: DataFetcher = {
  async sync(
    account: AccountConfig,
    since?: Date,
    reportStep?: (step: SyncStep) => void
  ): Promise<SyncResult> {
    const credentials: AmazonCredentials = {
      refresh_token: account.credentials.refresh_token,
      lwa_client_id: account.credentials.lwa_client_id,
      lwa_client_secret: account.credentials.lwa_client_secret,
      aws_access_key: account.credentials.aws_access_key,
      aws_secret_key: account.credentials.aws_secret_key,
      marketplace_id: account.credentials.marketplace_id,
    };

    // Default to last 30 days if no sync history
    const syncSince = since
      ? subDays(startOfDay(since), 1)
      : subDays(startOfDay(new Date()), 30);
    const today = format(new Date(), "yyyy-MM-dd");

    const steps: SyncStep[] = [];
    const allMetrics: NormalizedMetric[] = [];
    let totalRecords = 0;
    let hasAnyError = false;

    // Step 1: Get access token and validate credentials
    let accessToken: string;
    const t0 = Date.now();
    reportStep?.({
      key: "authenticate",
      label: "Authenticate with Amazon",
      status: "running",
    });

    try {
      accessToken = await getAccessToken(credentials);
      steps.push({
        key: "authenticate",
        label: "Authenticate with Amazon",
        status: "success",
        durationMs: Date.now() - t0,
      });
      reportStep?.(steps[steps.length - 1]);
    } catch (error) {
      const step: SyncStep = {
        key: "authenticate",
        label: "Authenticate with Amazon",
        status: "error",
        durationMs: Date.now() - t0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to authenticate with Amazon",
      };
      steps.push(step);
      reportStep?.(step);
      return {
        success: false,
        recordsProcessed: 0,
        metrics: [],
        steps,
        error: "Authentication failed - please check your credentials",
      };
    }

    // Step 2: Fetch marketplace participations (validates marketplace access)
    let participations: MarketplaceParticipation[] = [];
    const t1 = Date.now();
    reportStep?.({
      key: "fetch_marketplace",
      label: "Fetch marketplace info",
      status: "running",
    });

    try {
      participations = await fetchMarketplaceParticipations(
        credentials,
        accessToken
      );
      const step: SyncStep = {
        key: "fetch_marketplace",
        label: "Fetch marketplace info",
        status: "success",
        recordCount: participations.length,
        durationMs: Date.now() - t1,
      };
      steps.push(step);
      reportStep?.(step);
      totalRecords += participations.length;
    } catch (error) {
      hasAnyError = true;
      const step: SyncStep = {
        key: "fetch_marketplace",
        label: "Fetch marketplace info",
        status: "error",
        durationMs: Date.now() - t1,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch marketplace info",
      };
      steps.push(step);
      reportStep?.(step);
    }

    // Step 3: Fetch orders
    let orders: AmazonOrder[] = [];
    const t2 = Date.now();
    reportStep?.({
      key: "fetch_orders",
      label: "Fetch orders",
      status: "running",
    });

    try {
      orders = await fetchOrders(
        credentials,
        accessToken,
        syncSince,
        reportStep
      );
      const step: SyncStep = {
        key: "fetch_orders",
        label: "Fetch orders",
        status: "success",
        recordCount: orders.length,
        durationMs: Date.now() - t2,
      };
      steps.push(step);
      reportStep?.(step);
      totalRecords += orders.length;
    } catch (error) {
      hasAnyError = true;
      const step: SyncStep = {
        key: "fetch_orders",
        label: "Fetch orders",
        status: "error",
        durationMs: Date.now() - t2,
        error:
          error instanceof Error ? error.message : "Failed to fetch orders",
      };
      steps.push(step);
      reportStep?.(step);
    }

    // Step 4: Compute order metrics (includes fetching order items)
    let asinsWithSales = new Set<string>();
    if (orders.length > 0) {
      const t3 = Date.now();
      reportStep?.({
        key: "compute_metrics",
        label: "Compute revenue and sales metrics",
        status: "running",
      });

      try {
        const { metrics, asinsWithSales: asins } = await computeOrderMetrics(
          orders,
          credentials,
          accessToken,
          reportStep
        );
        allMetrics.push(...metrics);
        asinsWithSales = asins;
        const step: SyncStep = {
          key: "compute_metrics",
          label: "Compute revenue and sales metrics",
          status: "success",
          durationMs: Date.now() - t3,
        };
        steps.push(step);
        reportStep?.(step);
      } catch (error) {
        hasAnyError = true;
        const step: SyncStep = {
          key: "compute_metrics",
          label: "Compute revenue and sales metrics",
          status: "error",
          durationMs: Date.now() - t3,
          error:
            error instanceof Error
              ? error.message
              : "Failed to compute metrics",
        };
        steps.push(step);
        reportStep?.(step);
      }
    }

    // Step 5: Products count
    const productMetrics = computeProductsCount(asinsWithSales, today);
    allMetrics.push(...productMetrics);

    // If all steps failed, report overall failure
    const allFailed = steps.every((s) => s.status === "error");
    if (allFailed) {
      return {
        success: false,
        recordsProcessed: 0,
        metrics: [],
        steps,
        error: "All sync steps failed",
      };
    }

    return {
      success: true,
      recordsProcessed: totalRecords,
      metrics: allMetrics,
      steps,
      error: hasAnyError ? "Some sync steps failed" : undefined,
    };
  },

  async validateCredentials(
    credentials: Record<string, string>
  ): Promise<boolean> {
    try {
      const creds: AmazonCredentials = {
        refresh_token: credentials.refresh_token,
        lwa_client_id: credentials.lwa_client_id,
        lwa_client_secret: credentials.lwa_client_secret,
        aws_access_key: credentials.aws_access_key,
        aws_secret_key: credentials.aws_secret_key,
        marketplace_id: credentials.marketplace_id,
      };

      const accessToken = await getAccessToken(creds);
      const participations = await fetchMarketplaceParticipations(
        creds,
        accessToken
      );

      // Valid if we got at least one participating marketplace
      return participations.some((p) => p.participation.isParticipating);
    } catch {
      return false;
    }
  },
};
