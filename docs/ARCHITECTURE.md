# OhMyDashboard Architecture Summary

## Overview

OhMyDashboard is a local-first, privacy-focused dashboard that aggregates revenue and metrics from multiple e-commerce platforms (Gumroad, Stripe, RevenueCat). It runs as a Next.js web app with a local SQLite database, syncs data on-demand via external APIs, and displays unified metrics in a responsive dashboard UI.

## Architecture Layers

### 1. Integration Layer (`src/integrations/`)

**Pattern:** Each platform has its own folder with three files:
- `config.ts` — Exports constants (ID, name, icon, color) and defines:
  - `*Credentials` — Credential fields required from the user (API keys, tokens)
  - `*Permissions` — Human-readable permission list shown during OAuth/API key entry
  - `*MetricTypes` — List of metrics this integration can produce
- `fetcher.ts` — Implements the `DataFetcher` interface with:
  - `sync(account, since?, reportStep?)` — Fetches data from the platform API, returns normalized metrics
  - `validateCredentials(credentials)` — Tests credentials via a test API call
- `index.ts` — Imports config and fetcher, builds the `IntegrationDefinition` object, registers with the central registry

**Registry (`registry.ts`):**
- Central registry maps integration IDs to `IntegrationDefinition` objects
- `loadAllIntegrations()` imports each integration at startup (Stripe, Gumroad, RevenueCat)
- Adding a new integration = creating a new folder + adding one import line

### 2. Database Layer (`src/lib/db/`)

**Tech:** Drizzle ORM + SQLite (file-based, stored in the project)

**Schema (`schema.ts`):**

| Table | Purpose |
|-------|---------|
| `accounts` | One row per connected platform account. Stores encrypted credentials, label, integration ID |
| `projects` | Subset/filter within an account — typically one per product. Created automatically when metrics reference a `projectId` |
| `metrics` | **Universal metrics table.** All integrations write normalized data here with fields: `accountId`, `projectId`, `metricType`, `value`, `currency`, `date`, `metadata`. This enables cross-platform queries |
| `syncLogs` | Tracks sync history per account: status (success/error/running), timestamps, records processed |
| `projectGroups` | User-defined groups that merge data from multiple accounts/products into one logical view |
| `projectGroupMembers` | Membership rows linking accounts/projects to groups |
| `widgetConfigs` | Dashboard widget layout configuration |

**Key Design:**
- Metrics are **normalized** — every integration maps its raw data to common metric keys (revenue, sales_count, mrr, etc.)
- The same metric key from different platforms can be summed together in queries

### 3. Sync Engine (`src/lib/sync/`)

**`engine.ts` — `syncAccount()`:**
1. Loads account + decrypted credentials from DB
2. Calls the integration's `fetcher.sync(account, sinceDate)`
3. The fetcher returns an array of `NormalizedMetric` objects
4. Engine stores them in the `metrics` table (upserts on accountId + metricType + date + projectId + metadata)
5. Logs success/failure to `syncLogs`

**Sync is:**
- **On-demand only** — no built-in cron. User triggers via UI (`POST /api/sync`) or CLI
- **Incremental** — tracks last successful sync date, passes `since` to fetchers for delta syncs
- **Full-sync capable** — passing `fullSync: true` ignores the cursor and fetches everything

**Rate Limiting:**
- In-memory cooldown (60s) prevents rapid re-syncs
- Concurrent sync lock prevents duplicate runs for the same account

### 4. API Layer (`src/app/api/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations` | GET | List all integrations + connected accounts + last sync status |
| `/api/integrations` | POST | Connect a new account (validates credentials, encrypts, stores) |
| `/api/integrations/[id]` | PATCH/DELETE | Toggle account active state / delete account |
| `/api/sync` | POST | Trigger sync for one account or all accounts |
| `/api/sync` | GET | Poll sync status / progress |
| `/api/metrics` | GET | Query metrics for the dashboard (aggregates by date range, group, metric type) |
| `/api/project-groups` | CRUD | Manage project groups |

### 5. Frontend (`src/app/`, `src/components/`, `src/hooks/`)

**Pages:**
- `/` (page.tsx) — Main dashboard with metric cards, revenue chart, filters
- `/settings` (settings/page.tsx) — Integration management, account connections, project groups

**Key Components:**
- `MetricCard` — Displays a single metric (value, trend, sparkline)
- `RevenueChart` — Line/bar chart showing revenue over time
- `SyncStatusBar` — Shows sync progress, step-by-step status
- `DashboardFilter` — Date range picker, account/product filter
- `AddAccountDialog` — OAuth/API key entry form with credential field rendering

**Data Fetching:**
- `useMetrics` hook — Polls `/api/metrics` with date range + filters
- `useDashboardData` — Composes all dashboard data, handles loading states
- Auto-refreshes on sync completion

### 6. Security (`src/lib/`)

- **Credentials:** Encrypted with `lib/crypto/index.ts` (AES-256-GCM) before storing in SQLite
- **CSRF:** Validates origin on all API requests
- **Input Validation:** `lib/security/validation.ts` — validates account IDs, labels, credentials

### 7. Deployment

- **No Docker** — Currently runs as a standard Next.js app
- **Local-first:** SQLite file lives in the project directory
- **No cloud sync** — Data stays on the user's machine
- **CLI package** (`packages/cli/`) — Node.js CLI for headless sync

## Data Flow

```
User clicks "Sync" 
  → POST /api/sync { accountId }
  → syncAccount() in engine.ts
  → Integration fetcher.sync()
    → Calls external API (Stripe/Gumroad/RevenueCat)
    → Returns NormalizedMetric[]
  → storeMetrics() upserts to metrics table
  → Frontend polls /api/metrics → updates dashboard
```

## Extending with a New Platform

To add Amazon SP-API:

1. Create `src/integrations/amazon/` folder
2. Copy the Gumroad pattern:
   - `config.ts` — Define credentials (AWS keys + SP-API tokens), metric types
   - `fetcher.ts` — Implement `DataFetcher` interface
   - `index.ts` — Register the integration
3. Add one import line in `src/integrations/registry.ts` (`loadAllIntegrations()`)
4. The dashboard automatically picks up the new integration — no UI changes needed

The DB schema requires **no changes** — all Amazon data maps to existing `metrics` table columns via normalized metric types.
