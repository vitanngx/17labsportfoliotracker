# My Portfolio Tracker

## Why I built this

I'm a multi-assets investor, i wanna see how my investment grow overtime, But there is no Application that can do what I want. That's why I build this app to follow my investment.

This project is a personal portfolio tracker for monitoring transactions, holdings, allocation, cash balances, and portfolio performance across multiple asset classes and currencies.

## What this app does

- Tracks portfolio state entirely from transactions
- Supports multi-asset investing:
  - US stocks
  - ETFs
  - Crypto
  - Vietnam stocks
  - French stocks
- Fetches real market data with Python bridges
- Normalizes portfolio values into one base currency
- Shows portfolio value, allocation, holdings, cash, and performance in a dashboard
- Separates public viewing from admin transaction management

## Current features

- Public dashboard at `/dashboard`
- Admin login at `/admin`
- Protected admin dashboard at `/admin/dashboard`
- Transaction CRUD for admin users
- CSV import
- SQLite persistence
- Market quote caching
- FX normalization
- Holdings reconstruction from transactions
- Unrealized PnL
- Realized PnL
- Dividend tracking
- Cash balance tracking
- Allocation by asset
- Allocation by asset class
- Portfolio history
- Sharpe ratio, volatility, and max drawdown
- Timeframe-based approximate historical NAV chart:
  - `1D`
  - `7D`
  - `1M`
  - `3M`
  - `1Y`

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Python 3
- SQLite via `node:sqlite`
- `yfinance`
- `vnstock`

## Routes

- `/dashboard`
  - Public read-only dashboard
- `/admin`
  - Simple password login
- `/admin/dashboard`
  - Protected admin dashboard
  - Add, edit, delete transactions
  - Change base currency
  - Import CSV

## How to run locally

### 1. Install Node packages

```bash
npm install
```

### 2. Install Python packages

```bash
python3 -m pip install -r requirements.txt
```

### 3. Configure environment variables

Optional:

```bash
export ADMIN_PASSWORD="change-me"
export ADMIN_SESSION_SECRET="long-random-secret"
export PORTFOLIO_DATA_DIR="./data"
```

Defaults:

- `ADMIN_PASSWORD=admin123`
- `ADMIN_SESSION_SECRET` falls back to a derived local secret
- SQLite will use the local project data path unless overridden

### 4. Start the app

```bash
npm run dev
```

Open:

- [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- [http://localhost:3000/admin](http://localhost:3000/admin)

## How data flows

1. Transactions are stored in SQLite and act as the single source of truth.
2. The server reads transactions and settings.
3. Unique assets are extracted from the ledger.
4. Market data is fetched:
   - `vnstock` for Vietnam stocks when available
   - `yfinance` for US assets, crypto, French stocks, and FX
   - Yahoo HTTP fallback if needed
5. Latest quotes are merged with cached quotes.
6. FX rates are fetched so the entire portfolio can be reported in one base currency.
7. Calculation utilities rebuild:
   - holdings
   - cost basis
   - unrealized PnL
   - realized PnL
   - dividend income
   - cash balances
   - allocation
   - total portfolio value
   - historical portfolio series
8. The dashboard renders the resulting analytics for public or admin users.

## Transaction model

Supported transaction types:

- `BUY`
- `SELL`
- `DIVIDEND`
- `CASH_IN`
- `CASH_OUT`

Each transaction includes:

- `date`
- `asset`
- `assetClass`
- `type`
- `quantity`
- `price`
- `fees`
- `currency`
- `note` (optional)

## CSV import

Expected columns:

```text
date,asset,assetClass,type,quantity,price,fees,currency,note
```

Example:

```csv
date,asset,assetClass,type,quantity,price,fees,currency,note
2026-04-01,AAPL,US_STOCK,BUY,10,190,1,USD,starter position
2026-04-03,USD,CASH,CASH_IN,10000,1,0,USD,capital deposit
2026-04-10,VCB,VN_STOCK,BUY,200,59800,0,VND,vietnam sleeve
2026-04-18,AAPL,US_STOCK,DIVIDEND,1,5,0,USD,quarterly dividend
```

## Updating asset display names

Asset names shown in tables and allocation legends are generated from a local registry instead of being hardcoded in UI components.

Run:

```bash
npm run update-assets
```

This command:

- reads asset symbols from the local SQLite transaction ledger
- fetches asset metadata with `yfinance`
- writes the local cache to `data/asset-names.json`
- regenerates `src/lib/assets/assetName.js`

If a market metadata lookup fails, the app falls back to the symbol so the UI does not break.

## Project structure

```text
src/
  app/
  components/
    Dashboard/
  lib/
    assets/
    calculations/
    marketData/
  types/
python/
scripts/
render/
```

## Historical NAV note

The timeframe chart currently uses **approximate historical NAV**.

That means:

- it uses timeframe-specific market history
- it rebuilds an approximate NAV curve from current holdings and current cash balances
- it does not yet perform full point-in-time transaction reconstruction for every intraday timestamp

This is already useful for visual performance tracking, but it is not yet a perfect institutional-grade historical NAV engine.

## Deployment

This repository includes Render deployment support:

- [render.yaml](/Users/tan/Downloads/17labs/Portfolio%20Tracker/render.yaml)
- [Dockerfile](/Users/tan/Downloads/17labs/Portfolio%20Tracker/Dockerfile)
- [render/start.sh](/Users/tan/Downloads/17labs/Portfolio%20Tracker/render/start.sh)

Recommended Render setup:

1. Push the repo to GitHub.
2. Create a new Blueprint or Web Service in Render.
3. Use the included `render.yaml`.
4. Set:
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
5. Mount a persistent disk at `/var/data`.

Important notes:

- SQLite database path on Render: `/var/data/portfolio.db`
- Health check path: `/api/portfolio`
- Docker is used so Node and Python run consistently in one deployment

## Current limitations

- Admin authentication is still a simple password-based phase, not a full auth system
- Historical FX is not yet fully point-in-time accurate across all chart periods
- Historical NAV is approximate, not full transaction-time reconstruction
- CSV import is useful but still basic
- No broker API sync yet
- No multi-user system

## Suggested next improvements

- Historical NAV caching for faster timeframe switching
- Full point-in-time portfolio reconstruction
- Better FX history accuracy
- Lot-based realized PnL
- Stronger CSV validation and import preview
- Broker import adapters
- Benchmark comparison
- Better auth and session management

## Summary

This app exists because I wanted a portfolio tracker that actually fits the way I invest across multiple asset classes and currencies. Instead of hardcoding holdings, it rebuilds everything from the transaction ledger and turns it into a practical dashboard I can use to follow how my investments grow over time.
