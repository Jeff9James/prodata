import { pgTable, text, integer, real, uuid, timestamp, boolean, jsonb, check } from "drizzle-orm/pg-core";

// ─── Core Tables ────────────────────────────────────────────────────────────

/**
 * Accounts represent a single connection to an external service.
 * A user can have multiple accounts for the same integration (e.g., 3 Stripe accounts).
 */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // References auth.users
  integrationId: text("integration_id").notNull(), // e.g. "stripe"
  label: text("label").notNull(), // User-chosen name, e.g. "My SaaS Stripe"
  credentials: text("credentials").notNull(), // JSON string of encrypted credentials
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Projects represent a subset/filter within an account.
 * e.g., a specific product within a Stripe account.
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  filters: jsonb("filters").notNull().default({}), // JSON object of integration-specific filters
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Sync logs track when each account was last synced and the result.
 */
export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["success", "error", "running"] }).notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  recordsProcessed: integer("records_processed").default(0),
});

/**
 * Universal metrics table — all integrations write normalized data here.
 * This enables cross-integration queries (e.g., total revenue across all services).
 */
export const metrics = pgTable("metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  metricType: text("metric_type").notNull(), // e.g. "revenue", "subscriber_count", "downloads"
  value: real("value").notNull(),
  currency: text("currency"), // e.g. "USD", null for non-monetary metrics
  date: text("date").notNull(), // ISO date string (YYYY-MM-DD)
  metadata: jsonb("metadata").default({}), // JSON object for extra context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Widget configurations — what widgets the user has on their dashboard.
 */
export const widgetConfigs = pgTable("widget_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  widgetType: text("widget_type").notNull(), // e.g. "metric_card", "revenue_chart", "data_table"
  title: text("title").notNull(),
  config: jsonb("config").notNull().default({}), // JSON object with widget-specific settings
  position: integer("position").notNull().default(0), // Order in the grid
  size: text("size", { enum: ["sm", "md", "lg", "xl"] })
    .notNull()
    .default("md"),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Project groups let users merge data from multiple accounts/products
 * into a single logical project (e.g. "CSS Pro" across Gumroad + Stripe).
 */
export const projectGroups = pgTable("project_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(), // User-chosen name, e.g. "CSS Pro"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Members of a project group — each row maps an account or a specific
 * product within an account to a group.
 *
 * If projectId is NULL, the entire account is included.
 * If projectId is set, only that product's metrics are included.
 */
export const projectGroupMembers = pgTable("project_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => projectGroups.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  platform: text("platform").notNull(), // "amazon", "gumroad", "stripe", "revenuecat"
  productName: text("product_name").notNull(),
  productId: text("product_id"), // Platform-specific product ID
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  country: text("country"), // ISO 3166-1 alpha-2 country code
  countryName: text("country_name"), // Full country name
  timestamp: timestamp("timestamp").notNull(), // ISO datetime string
  metadata: jsonb("metadata").default({}), // JSON object for extra context (e.g. order ID, customer email)
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
export const productCogs = pgTable("product_cogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  productId: text("product_id").notNull(), // Platform-specific product ID (e.g., Stripe price_id, Gumroad product_id)
  platform: text("platform").notNull(), // "amazon", "gumroad", "stripe", "revenuecat"
  productName: text("product_name").notNull(), // Product display name
  cogsAmount: real("cogs_amount").notNull().default(0), // Cost per unit in product currency
  estimatedFeePercent: real("estimated_fee_percent").notNull().default(0), // Estimated platform fee % (e.g., 5 for 5%)
  currency: text("currency").notNull().default("USD"), // Currency for COGS
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ProductCog = typeof productCogs.$inferSelect;
export type NewProductCog = typeof productCogs.$inferInsert;

/**
 * Custom Goals - revenue targets and alert thresholds
 */
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(), // Goal name, e.g. "Monthly Revenue Target"
  targetValue: real("target_value").notNull(), // Target amount
  currentValue: real("current_value").notNull().default(0), // Current progress
  metricType: text("metric_type").notNull(), // "revenue", "mrr", "sales_count", "new_customers"
  period: text("period", { enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] }).notNull().default("monthly"),
  startDate: text("start_date").notNull(), // ISO date string
  endDate: text("end_date").notNull(), // ISO date string
  alertThreshold: real("alert_threshold").notNull().default(80), // Alert when % of target reached (default 80%)
  alertEnabled: boolean("alert_enabled").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  notifyOnAchieve: boolean("notify_on_achieve").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
