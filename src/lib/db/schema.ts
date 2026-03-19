import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Core Tables ────────────────────────────────────────────────────────────

/**
 * Accounts represent a single connection to an external service.
 * A user can have multiple accounts for the same integration (e.g., 3 Stripe accounts).
 */
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(), // UUID
  integrationId: text("integration_id").notNull(), // e.g. "stripe"
  label: text("label").notNull(), // User-chosen name, e.g. "My SaaS Stripe"
  credentials: text("credentials").notNull(), // JSON string of encrypted credentials
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(), // ISO string
  updatedAt: text("updated_at").notNull(), // ISO string
});

/**
 * Projects represent a subset/filter within an account.
 * e.g., a specific product within a Stripe account.
 */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // UUID
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  filters: text("filters").notNull().default("{}"), // JSON string of integration-specific filters
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Sync logs track when each account was last synced and the result.
 */
export const syncLogs = sqliteTable("sync_logs", {
  id: text("id").primaryKey(), // UUID
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["success", "error", "running"] }).notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  error: text("error"),
  recordsProcessed: integer("records_processed").default(0),
});

/**
 * Universal metrics table — all integrations write normalized data here.
 * This enables cross-integration queries (e.g., total revenue across all services).
 */
export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey(), // UUID
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  metricType: text("metric_type").notNull(), // e.g. "revenue", "subscriber_count", "downloads"
  value: real("value").notNull(),
  currency: text("currency"), // e.g. "USD", null for non-monetary metrics
  date: text("date").notNull(), // ISO date string (YYYY-MM-DD)
  metadata: text("metadata").default("{}"), // JSON string for extra context
  createdAt: text("created_at").notNull(),
});

/**
 * Widget configurations — what widgets the user has on their dashboard.
 */
export const widgetConfigs = sqliteTable("widget_configs", {
  id: text("id").primaryKey(), // UUID
  widgetType: text("widget_type").notNull(), // e.g. "metric_card", "revenue_chart", "data_table"
  title: text("title").notNull(),
  config: text("config").notNull().default("{}"), // JSON string with widget-specific settings
  position: integer("position").notNull().default(0), // Order in the grid
  size: text("size", { enum: ["sm", "md", "lg", "xl"] })
    .notNull()
    .default("md"),
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Project groups let users merge data from multiple accounts/products
 * into a single logical project (e.g. "CSS Pro" across Gumroad + Stripe).
 */
export const projectGroups = sqliteTable("project_groups", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(), // User-chosen name, e.g. "CSS Pro"
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Members of a project group — each row maps an account or a specific
 * product within an account to a group.
 *
 * If projectId is NULL, the entire account is included.
 * If projectId is set, only that product's metrics are included.
 */
export const projectGroupMembers = sqliteTable("project_group_members", {
  id: text("id").primaryKey(), // UUID
  groupId: text("group_id")
    .notNull()
    .references(() => projectGroups.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  createdAt: text("created_at").notNull(),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;
export type Metric = typeof metrics.$inferSelect;
export type NewMetric = typeof metrics.$inferInsert;
export type WidgetConfig = typeof widgetConfigs.$inferSelect;
export type NewWidgetConfig = typeof widgetConfigs.$inferInsert;
/**
 * Individual sales/orders table — stores detailed information about each sale
 * for live feed and world map visualization.
 */
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(), // UUID
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  platform: text("platform").notNull(), // "amazon", "gumroad", "stripe", "revenuecat"
  productName: text("product_name").notNull(),
  productId: text("product_id"), // Platform-specific product ID
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  country: text("country"), // ISO 3166-1 alpha-2 country code
  countryName: text("country_name"), // Full country name
  timestamp: text("timestamp").notNull(), // ISO datetime string (YYYY-MM-DDTHH:mm:ssZ)
  metadata: text("metadata").default("{}"), // JSON string for extra context (e.g. order ID, customer email)
  createdAt: text("created_at").notNull(),
});

// ─── Type Exports ───────────────────────────────────────────────────────────
export type ProjectGroup = typeof projectGroups.$inferSelect;
export type NewProjectGroup = typeof projectGroups.$inferInsert;
export type ProjectGroupMember = typeof projectGroupMembers.$inferSelect;
export type NewProjectGroupMember = typeof projectGroupMembers.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;

/**
 * Product COGS (Cost of Goods Sold) - user-editable costs/fees per product
 * Allows calculating net profit after platform fees and COGS
 */
export const productCogs = sqliteTable("product_cogs", {
  id: text("id").primaryKey(), // UUID
  productId: text("product_id").notNull(), // Platform-specific product ID (e.g., Stripe price_id, Gumroad product_id)
  platform: text("platform").notNull(), // "amazon", "gumroad", "stripe", "revenuecat"
  productName: text("product_name").notNull(), // Product display name
  cogsAmount: real("cogs_amount").notNull().default(0), // Cost per unit in product currency
  estimatedFeePercent: real("estimated_fee_percent").notNull().default(0), // Estimated platform fee % (e.g., 5 for 5%)
  currency: text("currency").notNull().default("USD"), // Currency for COGS
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ProductCog = typeof productCogs.$inferSelect;
export type NewProductCog = typeof productCogs.$inferInsert;

/**
 * Custom Goals - revenue targets and alert thresholds
 */
export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(), // Goal name, e.g. "Monthly Revenue Target"
  targetValue: real("target_value").notNull(), // Target amount
  currentValue: real("current_value").notNull().default(0), // Current progress
  metricType: text("metric_type").notNull(), // "revenue", "mrr", "sales_count", "new_customers"
  period: text("period", { enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] }).notNull().default("monthly"),
  startDate: text("start_date").notNull(), // ISO date string
  endDate: text("end_date").notNull(), // ISO date string
  alertThreshold: real("alert_threshold").notNull().default(80), // Alert when % of target reached (default 80%)
  alertEnabled: integer("alert_enabled", { mode: "boolean" }).notNull().default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notifyOnAchieve: integer("notify_on_achieve", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
