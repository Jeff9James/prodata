# Prodata - E-commerce & Digital Products Analytics

The daily cockpit for indie hackers, makers, and founders selling digital products and e-commerce goods.

Connect the tools you already use (Stripe, Gumroad, RevenueCat, Amazon today; more coming) and see a single, clean dashboard for revenue, customers, and product performance across all your businesses — with **profit tracking** that pure revenue tools don't offer.

Prodata is open source and runs locally. Your data stays on your machine.

![OhMyDashboard preview](docs/screenshots/dashboard.jpg)
![Sync log preview](docs/screenshots/sync.jpg)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Unselfisheologism/prodata)

## Why Prodata Exists

If you're selling digital products or running an e-commerce business, you're constantly switching between:

- **Stripe** for subscriptions and payments
- **Gumroad** for digital product sales
- **RevenueCat** for mobile app subscriptions
- **Amazon** for e-commerce sales
- Multiple seller accounts across platforms

Most analytics tools only show you **revenue** — but what matters is **profit**. Prodata gives you the full picture:

- ✅ Revenue tracking across all platforms
- ✅ **Net profit calculations** after COGS and platform fees
- ✅ **Custom goals** with progress tracking and alerts
- ✅ Live sales feed showing transactions in real-time
- ✅ Geographic breakdown of your customers
- ✅ Product-level performance analytics

## Key Features

### 🌍 Live Feed & World Map
- See transactions as they happen with the live sales feed
- Visualize customer locations on an interactive world map
- Perfect for understanding your global customer base

### 📊 Revenue Breakdowns
- Revenue by country — see which markets perform best
- Revenue by product — identify your top sellers
- Platform attribution — understand which渠道 drives the most revenue

### 💰 Profit Edge Over Pure Revenue Tools

**What makes Prodata different from standard analytics tools:**

| Feature | Prodata | Typical Revenue Tools |
|---------|---------|----------------------|
| Revenue tracking | ✅ | ✅ |
| Net profit after COGS | ✅ | ❌ |
| Platform fee estimation | ✅ | ❌ |
| Custom revenue goals | ✅ | ❌ |
| Goal progress alerts | ✅ | ❌ |
| Live transaction feed | ✅ | Rare |
| Privacy-first (local) | ✅ | Rare |

### 🎯 Custom Goals & Alerts
- Set revenue, MRR, sales count, or customer targets
- Choose daily, weekly, monthly, quarterly, or yearly periods
- Get in-app notifications when you hit your alert threshold
- Visual progress bars show how close you are to your goals

### 💵 COGS & Profit Tracking
- Add cost per unit for each product
- Configure estimated platform fee percentages
- See net profit after costs and fees
- Make data-driven decisions about pricing and margins

## Getting Started

### Option A: one‑line install (CLI)

```bash
npx ohmydashboard
```

This will:
- clone the repo into `./ohmydashboard`
- install dependencies
- print the next steps to run the app

Requirements: `git` and `pnpm`.

### Option B: manual install

```bash
git clone <repo-url>
cd ohmydashboard
pnpm install
```

### 2) Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3) Connect your accounts

Go to [http://localhost:3000/settings](http://localhost:3000/settings) and
add your integrations (Stripe, Gumroad, RevenueCat). Credentials are stored
locally, never sent to any external server.

### 4) Track your profit

Visit [http://localhost:3000/settings/profit](http://localhost:3000/settings/profit) to:
- Add product costs (COGS) for accurate profit calculations
- Set custom revenue goals with alerts
- View net profit after costs and fees

## What You Get

- One dashboard for all products and accounts
- Revenue and sales trends by day
- Source leaderboards and product groupings
- Customers by country (paying vs all)
- **Net profit tracking** after COGS and fees
- **Custom goals** with progress bars and alerts
- **Live sales feed** with real-time updates
- **World map** showing customer locations
- Local-first storage (SQLite) — your data never leaves your machine

## Architecture Goals

- Simple to add integrations
- Supports multiple accounts per integration
- Supports projects per account and blended rollups
- Clear metric standards for accurate aggregation
- Test-driven development for safe iteration

## Local Storage

OhMyDashboard stores data in a local SQLite database at:

```
.ohmydashboard/data.db
```

You can delete this file at any time to reset the app.

## Integrations

### Current Integrations

- **Stripe** — Subscriptions, one-time payments
- **Gumroad** — Digital products, courses, memberships
- **RevenueCat** — Mobile app subscriptions (iOS, Android)
- **Amazon** — E-commerce sales data

### Planned Integrations

App Store Connect, Mixpanel, X (Twitter), and Facebook Ads.

## Privacy First

- All data stored locally in SQLite
- No external servers — your business data never leaves your machine
- Credentials encrypted at rest
- Perfect for sensitive business data

## Contributing

We care about tests. If you add or change behavior, add tests.

Quick check:

```bash
pnpm test
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
```

---

Built for indie makers and digital product sellers who care about profit, not just revenue.
