import type {
    CredentialField,
    MetricTypeDefinition,
    RequiredPermission,
} from "../types";

export const DODO_ID = "dodo";
export const DODO_NAME = "Dodo Payments";
export const DODO_DESCRIPTION =
    "Connect your Dodo Payments account to track revenue, subscriptions, and transactions.";
export const DODO_ICON = "CreditCard";
export const DODO_COLOR = "#6C5CE7";

export const dodoCredentials: CredentialField[] = [
    {
        key: "api_key",
        label: "API Key",
        type: "password",
        placeholder: "Your Dodo Payments API key",
        helpUrl: "https://docs.dodopayments.com/developer-resources/integration-guide",
        helpText:
            "Find your API key in the Dodo Payments dashboard under Developer > API Keys. " +
            "Use a secret key (not publishable) for server-side integration.",
        required: true,
    },
    {
        key: "environment",
        label: "Environment",
        type: "text",
        placeholder: "test_mode or live_mode",
        helpUrl: "https://docs.dodopayments.com/developer-resources/integration-guide",
        helpText:
            "Use 'test_mode' for testing with sandbox payments, 'live_mode' for production. " +
            "Defaults to 'live_mode' if not specified.",
        required: false,
    },
];

export const dodoPermissions: RequiredPermission[] = [
    {
        resource: "payments",
        label: "Payments",
        access: "read",
        reason: "Fetch payment data to compute daily revenue, transaction counts, and refund data",
    },
    {
        resource: "subscriptions",
        label: "Subscriptions",
        access: "read",
        reason: "List active subscriptions to calculate MRR and subscription count",
    },
    {
        resource: "customers",
        label: "Customers",
        access: "read",
        reason: "Count new customers created over time",
    },
];

export const dodoMetricTypes: MetricTypeDefinition[] = [
    {
        key: "revenue",
        label: "Revenue",
        format: "currency",
        description: "Total revenue from successful payments",
    },
    {
        key: "subscription_revenue",
        label: "Subscription Revenue",
        format: "currency",
        description: "Revenue from subscription payments",
    },
    {
        key: "one_time_revenue",
        label: "One-Time Revenue",
        format: "currency",
        description: "Revenue from one-time (non-subscription) payments",
    },
    {
        key: "charges_count",
        label: "Transactions",
        format: "number",
        description: "Number of successful payments",
    },
    {
        key: "sales_count",
        label: "Sales",
        format: "number",
        description: "Number of successful payments (unified with other integrations)",
    },
    {
        key: "refunds",
        label: "Refunds",
        format: "currency",
        description: "Total refund amount",
    },
    {
        key: "active_subscriptions",
        label: "Active Subscriptions",
        format: "number",
        description: "Number of currently active subscriptions",
    },
    {
        key: "mrr",
        label: "MRR",
        format: "currency",
        description: "Monthly Recurring Revenue from active subscriptions",
    },
    {
        key: "new_customers",
        label: "New Customers",
        format: "number",
        description: "Number of new customers created",
    },
];
