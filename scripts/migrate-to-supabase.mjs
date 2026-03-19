/**
 * Migration script to export data from SQLite and prepare for Supabase PostgreSQL
 * 
 * Usage:
 * 1. First, create a user account in your Supabase project
 * 2. Get the user's ID from Supabase Dashboard or via API
 * 3. Run: node scripts/migrate-to-supabase.mjs <USER_ID>
 * 
 * The script will:
 * - Read data from .ohmydashboard/data.db (SQLite)
 * - Transform it to match PostgreSQL schema with user_id
 * - Output JSON files ready for import via Supabase dashboard or API
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(process.cwd(), ".ohmydashboard/data.db");
const OUTPUT_DIR = path.join(__dirname, "../migration-export");

// Check if user ID is provided
const userId = process.argv[2];
if (!userId) {
    console.error("Usage: node scripts/migrate-to-supabase.mjs <USER_ID>");
    console.error("\nTo get your user ID:");
    console.error("1. Sign up at your app at http://localhost:3000/auth/signup");
    console.error("2. Go to Supabase Dashboard > Authentication > Users");
    console.error("3. Copy the User UUID");
    console.error("\nExample: node scripts/migrate-to-supabase.mjs 12345678-1234-1234-1234-123456789abc");
    process.exit(1);
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(userId)) {
    console.error("Invalid UUID format. Please provide a valid user ID.");
    process.exit(1);
}

console.log(`Using user ID: ${userId}`);
console.log(`Database path: ${DB_PATH}`);

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    console.error("Please run the app first to create the local database.");
    process.exit(1);
}

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Connect to SQLite
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Helper to generate new UUID
function generateUuid() {
    return uuidv4();
}

// Helper to convert date string to ISO timestamp
function toTimestamp(dateStr) {
    if (!dateStr) return new Date().toISOString();
    // If it's already ISO format, return as is
    if (dateStr.includes("T")) return dateStr;
    // Otherwise assume it's a date string
    return new Date(dateStr).toISOString();
}

// Helper to convert SQLite JSON string to PostgreSQL JSON
function toJson(sqliteJson) {
    try {
        return JSON.parse(sqliteJson || "{}");
    } catch {
        return {};
    }
}

// Export tables
console.log("\nExporting data...");

const exportTable = (tableName, transformFn) => {
    try {
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        const transformed = rows.map(transformFn);
        const outputPath = path.join(OUTPUT_DIR, `${tableName}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(transformed, null, 2));
        console.log(`✓ Exported ${rows.length} rows from ${tableName}`);
        return transformed;
    } catch (err) {
        console.log(`○ Table ${tableName} not found or empty (${err.message})`);
        return [];
    }
};

// Export accounts
const accountsMap = new Map();
const accounts = exportTable("accounts", (row) => {
    const newId = generateUuid();
    accountsMap.set(row.id, newId);
    return {
        id: newId,
        user_id: userId,
        integration_id: row.integration_id,
        label: row.label,
        credentials: row.credentials,
        is_active: row.is_active === 1,
        created_at: toTimestamp(row.created_at),
        updated_at: toTimestamp(row.updated_at),
    };
});

// Export projects
const projectsMap = new Map();
const projects = exportTable("projects", (row) => {
    const newId = generateUuid();
    projectsMap.set(row.id, newId);
    return {
        id: newId,
        user_id: userId,
        account_id: accountsMap.get(row.account_id),
        label: row.label,
        filters: toJson(row.filters),
        created_at: toTimestamp(row.created_at),
        updated_at: toTimestamp(row.updated_at),
    };
});

// Export sync_logs
exportTable("sync_logs", (row) => ({
    id: generateUuid(),
    user_id: userId,
    account_id: accountsMap.get(row.account_id),
    status: row.status,
    started_at: toTimestamp(row.started_at),
    completed_at: row.completed_at ? toTimestamp(row.completed_at) : null,
    error: row.error,
    records_processed: row.records_processed,
}));

// Export metrics
exportTable("metrics", (row) => ({
    id: generateUuid(),
    user_id: userId,
    account_id: accountsMap.get(row.account_id),
    project_id: row.project_id ? projectsMap.get(row.project_id) : null,
    metric_type: row.metric_type,
    value: row.value,
    currency: row.currency,
    date: row.date,
    metadata: toJson(row.metadata),
    created_at: toTimestamp(row.created_at),
}));

// Export widget_configs
exportTable("widget_configs", (row) => ({
    id: generateUuid(),
    user_id: userId,
    widget_type: row.widget_type,
    title: row.title,
    config: toJson(row.config),
    position: row.position,
    size: row.size,
    is_visible: row.is_visible === 1,
    created_at: toTimestamp(row.created_at),
    updated_at: toTimestamp(row.updated_at),
}));

// Export project_groups
const groupsMap = new Map();
const projectGroups = exportTable("project_groups", (row) => {
    const newId = generateUuid();
    groupsMap.set(row.id, newId);
    return {
        id: newId,
        user_id: userId,
        name: row.name,
        created_at: toTimestamp(row.created_at),
        updated_at: toTimestamp(row.updated_at),
    };
});

// Export project_group_members
exportTable("project_group_members", (row) => ({
    id: generateUuid(),
    user_id: userId,
    group_id: groupsMap.get(row.group_id),
    account_id: accountsMap.get(row.account_id),
    project_id: row.project_id ? projectsMap.get(row.project_id) : null,
    created_at: toTimestamp(row.created_at),
}));

// Export sales
exportTable("sales", (row) => ({
    id: generateUuid(),
    user_id: userId,
    account_id: accountsMap.get(row.account_id),
    project_id: row.project_id ? projectsMap.get(row.project_id) : null,
    platform: row.platform,
    product_name: row.product_name,
    product_id: row.product_id,
    amount: row.amount,
    currency: row.currency,
    country: row.country,
    country_name: row.country_name,
    timestamp: toTimestamp(row.timestamp),
    metadata: toJson(row.metadata),
    created_at: toTimestamp(row.created_at),
}));

// Export product_cogs
exportTable("product_cogs", (row) => ({
    id: generateUuid(),
    user_id: userId,
    product_id: row.product_id,
    platform: row.platform,
    product_name: row.product_name,
    cogs_amount: row.cogs_amount,
    estimated_fee_percent: row.estimated_fee_percent,
    currency: row.currency,
    created_at: toTimestamp(row.created_at),
    updated_at: toTimestamp(row.updated_at),
}));

// Export goals
exportTable("goals", (row) => ({
    id: generateUuid(),
    user_id: userId,
    name: row.name,
    target_value: row.target_value,
    current_value: row.current_value,
    metric_type: row.metric_type,
    period: row.period,
    start_date: row.start_date,
    end_date: row.end_date,
    alert_threshold: row.alert_threshold,
    alert_enabled: row.alert_enabled === 1,
    is_active: row.is_active === 1,
    notify_on_achieve: row.notify_on_achieve === 1,
    created_at: toTimestamp(row.created_at),
    updated_at: toTimestamp(row.updated_at),
}));

// Save ID mappings for reference
const mappings = {
    userId,
    accounts: Object.fromEntries(accountsMap),
    projects: Object.fromEntries(projectsMap),
    groups: Object.fromEntries(groupsMap),
};
fs.writeFileSync(
    path.join(OUTPUT_DIR, "id-mappings.json"),
    JSON.stringify(mappings, null, 2)
);

// Close database
db.close();

console.log(`\n✓ Migration export complete!`);
console.log(`Output directory: ${OUTPUT_DIR}`);
console.log(`\nTo import to Supabase:`);
console.log(`1. Go to Supabase Dashboard > SQL Editor`);
console.log(`2. Run the SQL from migration-export/*.json files`);
console.log(`   OR use the Table Editor to import JSON files`);
console.log(`\nNote: The script generated new UUIDs for all records.`);
console.log(`ID mappings saved to: ${OUTPUT_DIR}/id-mappings.json`);
