import { format, subDays, startOfDay } from "date-fns";
import type {
    AccountConfig,
    DataFetcher,
    NormalizedMetric,
    SyncResult,
    SyncStep,
} from "../types";

// ─── Dodo API types ──────────────────────────────────────────────────────

const DODO_API_BASE = "https://live.dodopayments.com";

interface DodoPayment {
    payment_id: string;
    amount: number; // in cents
    currency: string;
    status: "succeeded" | "failed" | "cancelled" | "processing" | string;
    created_at: string; // ISO 8601
    customer_id?: string;
    customer_email?: string;
    customer_name?: string;
    subscription_id?: string;
    refunded: boolean;
    brand_id?: string;
    product_id?: string;
}

interface DodoSubscription {
    subscription_id: string;
    status: "active" | "cancelled" | "expired" | "on_hold" | string;
    product_id: string;
    customer_id: string;
    customer_email?: string;
    customer_name?: string;
    current_period_start: string;
    current_period_end: string;
    amount: number; // in cents
    currency: string;
    interval: "day" | "week" | "month" | "year";
    created_at: string;
}

interface DodoCustomer {
    customer_id: string;
    email?: string;
    name?: string;
    created_at: string;
    metadata?: Record<string, string>;
}

interface PaymentListResponse {
    items: DodoPayment[];
    has_next_page: boolean;
    next_page_number?: number;
}

interface SubscriptionListResponse {
    items: DodoSubscription[];
    has_next_page: boolean;
    next_page_number?: number;
}

interface CustomerListResponse {
    items: DodoCustomer[];
    has_next_page: boolean;
    next_page_number?: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────

async function dodoGet<T>(
    endpoint: string,
    apiKey: string,
    params?: Record<string, string>
): Promise<T> {
    const url = new URL(`${DODO_API_BASE}${endpoint}`);
    if (params) {
        for (const [key, val] of Object.entries(params)) {
            url.searchParams.set(key, val);
        }
    }

    const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Dodo API error ${res.status}: ${body.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
}

// ─── Data fetching ─────────────────────────────────────────────────────

/**
 * Fetch all payments since a given date, handling pagination.
 */
async function fetchPayments(
    apiKey: string,
    since: Date
): Promise<DodoPayment[]> {
    const payments: DodoPayment[] = [];
    let pageNumber = 0;
    const pageSize = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const data = await dodoGet<PaymentListResponse>(
            "/payments",
            apiKey,
            {
                created_at_gte: since.toISOString(),
                page_number: String(pageNumber),
                page_size: String(pageSize),
            }
        );

        if (data.items) {
            payments.push(...data.items);
        }

        if (!data.has_next_page || !data.next_page_number) {
            break;
        }

        pageNumber = data.next_page_number;
    }

    return payments;
}

/**
 * Fetch active subscriptions.
 */
async function fetchActiveSubscriptions(
    apiKey: string
): Promise<DodoSubscription[]> {
    const subscriptions: DodoSubscription[] = [];
    let pageNumber = 0;
    const pageSize = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const data = await dodoGet<SubscriptionListResponse>(
            "/subscriptions",
            apiKey,
            {
                page_number: String(pageNumber),
                page_size: String(pageSize),
            }
        );

        if (data.items) {
            // Filter for active subscriptions only
            const activeSubs = data.items.filter(
                (sub) => sub.status === "active"
            );
            subscriptions.push(...activeSubs);
        }

        if (!data.has_next_page || !data.next_page_number) {
            break;
        }

        pageNumber = data.next_page_number;
    }

    return subscriptions;
}

/**
 * Fetch new customers created since a given date.
 */
async function fetchNewCustomers(
    apiKey: string,
    since: Date
): Promise<DodoCustomer[]> {
    const customers: DodoCustomer[] = [];
    let pageNumber = 0;
    const pageSize = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const data = await dodoGet<CustomerListResponse>(
            "/customers",
            apiKey,
            {
                created_at_gte: since.toISOString(),
                page_number: String(pageNumber),
                page_size: String(pageSize),
            }
        );

        if (data.items) {
            customers.push(...data.items);
        }

        if (!data.has_next_page || !data.next_page_number) {
            break;
        }

        pageNumber = data.next_page_number;
    }

    return customers;
}

// ─── Metric computation ─────────────────────────────────────────────────

/**
 * Group payments by day and compute daily revenue.
 * Classifies each payment as subscription vs one-time based on subscription_id.
 */
function computeDailyRevenue(
    payments: DodoPayment[]
): NormalizedMetric[] {
    const dailyMap = new Map<
        string,
        {
            revenue: number;
            subscriptionRevenue: number;
            oneTimeRevenue: number;
            count: number;
            refunds: number;
            currency: string;
        }
    >();

    for (const payment of payments) {
        if (payment.status !== "succeeded") continue;
        if (payment.refunded) continue;

        const date = format(new Date(payment.created_at), "yyyy-MM-dd");
        const currency = (payment.currency || "USD").toUpperCase();
        const existing = dailyMap.get(date) || {
            revenue: 0,
            subscriptionRevenue: 0,
            oneTimeRevenue: 0,
            count: 0,
            refunds: 0,
            currency,
        };

        // Dodo amounts are in cents
        const amountDollars = payment.amount / 100;

        existing.revenue += amountDollars;
        existing.count += 1;
        existing.currency = currency;

        // Classify subscription vs one-time payments
        if (payment.subscription_id) {
            existing.subscriptionRevenue += amountDollars;
        } else {
            existing.oneTimeRevenue += amountDollars;
        }

        dailyMap.set(date, existing);
    }

    const metrics: NormalizedMetric[] = [];

    for (const [date, data] of dailyMap) {
        metrics.push({
            metricType: "revenue",
            value: data.revenue,
            currency: data.currency,
            date,
        });

        metrics.push({
            metricType: "charges_count",
            value: data.count,
            date,
        });

        metrics.push({
            metricType: "sales_count",
            value: data.count,
            date,
        });

        metrics.push({
            metricType: "subscription_revenue",
            value: data.subscriptionRevenue,
            currency: data.currency,
            date,
        });

        metrics.push({
            metricType: "one_time_revenue",
            value: data.oneTimeRevenue,
            currency: data.currency,
            date,
        });
    }

    return metrics;
}

/**
 * Compute MRR from active subscriptions.
 */
function computeMRR(
    subscriptions: DodoSubscription[],
    today: string
): NormalizedMetric[] {
    let totalMRR = 0;
    let currency = "USD";

    for (const sub of subscriptions) {
        if (sub.status !== "active") continue;

        const amountDollars = sub.amount / 100;
        currency = (sub.currency || "USD").toUpperCase();

        // Normalize to monthly based on interval
        switch (sub.interval) {
            case "day":
                totalMRR += amountDollars * 30;
                break;
            case "week":
                totalMRR += amountDollars * 4.33;
                break;
            case "month":
                totalMRR += amountDollars;
                break;
            case "year":
                totalMRR += amountDollars / 12;
                break;
        }
    }

    return [
        {
            metricType: "mrr",
            value: Math.round(totalMRR * 100) / 100,
            currency,
            date: today,
        },
        {
            metricType: "active_subscriptions",
            value: subscriptions.length,
            date: today,
        },
    ];
}

/**
 * Compute daily new customer counts.
 */
function computeNewCustomers(
    customers: DodoCustomer[]
): NormalizedMetric[] {
    const dailyMap = new Map<string, number>();

    for (const customer of customers) {
        const date = format(new Date(customer.created_at), "yyyy-MM-dd");
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    }

    const metrics: NormalizedMetric[] = [];

    for (const [date, count] of dailyMap) {
        metrics.push({
            metricType: "new_customers",
            value: count,
            date,
        });
    }

    return metrics;
}

// ─── Data fetcher implementation ────────────────────────────────────────

export const dodoFetcher: DataFetcher = {
    async sync(
        account: AccountConfig,
        since?: Date,
        reportStep?: (step: SyncStep) => void
    ): Promise<SyncResult> {
        const apiKey = account.credentials.api_key;
        const syncSince = since || subDays(startOfDay(new Date()), 30);
        const today = format(new Date(), "yyyy-MM-dd");

        const steps: SyncStep[] = [];
        const allMetrics: NormalizedMetric[] = [];
        let totalRecords = 0;
        let hasAnyError = false;

        // Step 1: Fetch payments
        let payments: DodoPayment[] = [];
        let t0 = Date.now();
        reportStep?.({
            key: "fetch_payments",
            label: "Fetch payments & revenue",
            status: "running",
        });
        try {
            payments = await fetchPayments(apiKey, syncSince);
            const revenueMetrics = computeDailyRevenue(payments);
            allMetrics.push(...revenueMetrics);
            totalRecords += payments.length;
            const step: SyncStep = {
                key: "fetch_payments",
                label: "Fetch payments & revenue",
                status: "success",
                recordCount: payments.length,
                durationMs: Date.now() - t0,
            };
            steps.push(step);
            reportStep?.(step);
        } catch (error) {
            hasAnyError = true;
            const step: SyncStep = {
                key: "fetch_payments",
                label: "Fetch payments & revenue",
                status: "error",
                durationMs: Date.now() - t0,
                error: error instanceof Error ? error.message : "Failed to fetch payments",
            };
            steps.push(step);
            reportStep?.(step);
        }

        // Step 2: Fetch subscriptions + compute MRR
        let subscriptions: DodoSubscription[] = [];
        t0 = Date.now();
        reportStep?.({
            key: "fetch_subscriptions",
            label: "Fetch subscriptions & MRR",
            status: "running",
        });
        try {
            subscriptions = await fetchActiveSubscriptions(apiKey);
            const subscriptionMetrics = computeMRR(subscriptions, today);
            allMetrics.push(...subscriptionMetrics);
            totalRecords += subscriptions.length;
            const step: SyncStep = {
                key: "fetch_subscriptions",
                label: "Fetch subscriptions & MRR",
                status: "success",
                recordCount: subscriptions.length,
                durationMs: Date.now() - t0,
            };
            steps.push(step);
            reportStep?.(step);
        } catch (error) {
            hasAnyError = true;
            const step: SyncStep = {
                key: "fetch_subscriptions",
                label: "Fetch subscriptions & MRR",
                status: "error",
                durationMs: Date.now() - t0,
                error: error instanceof Error ? error.message : "Failed to fetch subscriptions",
            };
            steps.push(step);
            reportStep?.(step);
        }

        // Step 3: Fetch customers
        t0 = Date.now();
        reportStep?.({
            key: "fetch_customers",
            label: "Fetch new customers",
            status: "running",
        });
        try {
            const customers = await fetchNewCustomers(apiKey, syncSince);
            const customerMetrics = computeNewCustomers(customers);
            allMetrics.push(...customerMetrics);
            totalRecords += customers.length;
            const step: SyncStep = {
                key: "fetch_customers",
                label: "Fetch new customers",
                status: "success",
                recordCount: customers.length,
                durationMs: Date.now() - t0,
            };
            steps.push(step);
            reportStep?.(step);
        } catch (error) {
            hasAnyError = true;
            const step: SyncStep = {
                key: "fetch_customers",
                label: "Fetch new customers",
                status: "error",
                durationMs: Date.now() - t0,
                error: error instanceof Error ? error.message : "Failed to fetch customers",
            };
            steps.push(step);
            reportStep?.(step);
        }

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
            const apiKey = credentials.api_key;
            // Make a simple API call to verify the key works
            await dodoGet<{ items: unknown[] }>("/payments", apiKey, {
                page_size: "1",
            });
            return true;
        } catch {
            return false;
        }
    },
};
