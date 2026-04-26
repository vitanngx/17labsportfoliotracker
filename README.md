# My Portfolio Tracker

Phase 2 of a transaction-driven portfolio tracker built with Next.js, TypeScript, Tailwind CSS, Recharts, Python market-data bridges, and SQLite persistence.

## What changed in Phase 2

- Public/admin access separation
  - `/dashboard` is read-only
  - `/admin` is a simple password gate
  - `/admin/dashboard` exposes transaction management
- SQLite persistence for transactions, settings, and cached quotes
- Base-currency reporting with FX normalization
- Admin transaction CRUD
- CSV import for transaction history
- Cash balance tracking
- Realized PnL and dividend tracking
- Stronger historical analytics including drawdown

## Routes

- `/dashboard`
  - Public read-only dashboard
  - No transaction mutation controls
- `/admin`
  - Simple password form
- `/admin/dashboard`
  - Protected admin dashboard
  - Add/edit/delete transactions
  - Change base currency
  - Import CSV

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Python 3
- SQLite via Node `node:sqlite`
- `yfinance`
- `vnstock`

## Setup

### 1. Install Node packages

```bash
npm install
```

### 2. Install Python packages

```bash
python3 -m pip install -r requirements.txt
```

### 3. Configure admin password

Optional environment variables:

```bash
export ADMIN_PASSWORD="change-me"
export ADMIN_SESSION_SECRET="long-random-secret"
```

Defaults:

- `ADMIN_PASSWORD=admin123`
- `ADMIN_SESSION_SECRET` falls back to a derived local secret

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

## Deploy on Render

This repository now includes:

- [render.yaml](/Users/tan/Downloads/17labs/Portfolio Tracker/render.yaml)
- [Dockerfile](/Users/tan/Downloads/17labs/Portfolio Tracker/Dockerfile)
- [render/start.sh](/Users/tan/Downloads/17labs/Portfolio Tracker/render/start.sh)

Recommended setup on Render:

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Use the included `render.yaml`.
4. Set these secret environment variables in Render:
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
5. Keep the persistent disk mounted at `/var/data`.

Important notes:

- SQLite will live on the persistent disk at `/var/data/portfolio.db`.
- Public route is `/dashboard`.
- Admin login route is `/admin`.
- The health check uses `/api/portfolio`.
- This Render setup uses Docker so both Node and Python are installed consistently.

If you deploy manually instead of Blueprint:

- Runtime: Docker
- Dockerfile: `./Dockerfile`
- Persistent disk mount path: `/var/data`
- Health check path: `/api/portfolio`

## Data model

Transactions are the single source of truth. Portfolio state is reconstructed from:

- `BUY`
- `SELL`
- `DIVIDEND`
- `CASH_IN`
- `CASH_OUT`

Each transaction stores:

- date
- asset
- asset class
- type
- quantity
- price
- fees
- currency
- optional note

## How data flows

1. Public or admin page requests portfolio data.
2. The server reads transactions and settings from SQLite.
3. Unique assets are extracted from the ledger.
4. The server fetches market quotes:
   - `vnstock` first for Vietnamese stocks
   - `yfinance` for US assets, crypto, and FX
   - Yahoo HTTP fallback if library fetches fail
5. Latest quotes are merged with cached quotes stored in SQLite.
6. FX pairs are fetched so all portfolio metrics can be normalized into the configured base currency.
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
   - Sharpe, volatility, and max drawdown
8. Public users receive read-only data.
9. Admin users can mutate the transaction ledger through protected routes only.

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

## Notes

- Public users cannot access transaction mutation actions from the UI.
- Admin routes reject unauthenticated writes server-side.
- The app uses a simple password cookie for Phase 2, not a full auth system.
- Base-currency normalization is now present across holdings, cash, and top-level reporting.
- Historical FX normalization still uses the latest available FX layer rather than a full point-in-time FX archive.

## Suggested Phase 3 improvements

- Replace simple password auth with real users and role-based access control
- Add transaction filters, search, and pagination
- Add broker import adapters
- Add point-in-time FX history for even better historical performance accuracy
- Add benchmark comparison and attribution
- Add dividend schedule views, realized tax lots, and tax reporting
- Add recurring quote refresh jobs and local API service orchestration
