import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  BenchmarkPerformanceResponse,
  HistoricalNavResponse,
  PortfolioSettings,
  Transaction,
  TransactionInput
} from "@/types/portfolio";

const defaultDataDirectory = path.join(process.cwd(), "data");
const configuredDataDirectory =
  process.env.PORTFOLIO_DATA_DIR?.trim() ||
  process.env.RENDER_DISK_MOUNT_PATH?.trim() ||
  defaultDataDirectory;
const configuredDatabasePath =
  process.env.PORTFOLIO_DB_PATH?.trim() ||
  path.join(configuredDataDirectory, "portfolio.db");
const dataDirectory = path.dirname(configuredDatabasePath);
const databasePath = configuredDatabasePath;

function ensureDataDirectory() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }
}

function withDatabase<T>(run: (database: DatabaseSync) => T): T {
  ensureDataDirectory();
  const database = new DatabaseSync(databasePath);
  migrate(database);

  try {
    return run(database);
  } finally {
    database.close();
  }
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      asset TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      fees REAL NOT NULL,
      currency TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historical_nav_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmark_performance_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database
    .prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('base_currency', 'USD')`)
    .run();
}

export function listTransactions() {
  return withDatabase((database) => {
    const rows = database
      .prepare(
        `SELECT id, date, asset, asset_class, type, quantity, price, fees, currency, note, created_at, updated_at
         FROM transactions
         ORDER BY date ASC, created_at ASC, id ASC`
      )
      .all() as Array<Record<string, unknown>>;

    return rows.map(mapRowToTransaction);
  });
}

export function insertTransaction(input: TransactionInput) {
  return withDatabase((database) => {
    const now = new Date().toISOString();
    const id = cryptoRandomId();

    database
      .prepare(
        `INSERT INTO transactions
         (id, date, asset, asset_class, type, quantity, price, fees, currency, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.date,
        input.asset,
        input.assetClass,
        input.type,
        input.quantity,
        input.price,
        input.fees,
        input.currency,
        input.note ?? null,
        now,
        now
      );

    return getTransactionById(database, id);
  });
}

export function updateTransaction(id: string, input: TransactionInput) {
  return withDatabase((database) => {
    const now = new Date().toISOString();

    database
      .prepare(
        `UPDATE transactions
         SET date = ?, asset = ?, asset_class = ?, type = ?, quantity = ?, price = ?, fees = ?, currency = ?, note = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.date,
        input.asset,
        input.assetClass,
        input.type,
        input.quantity,
        input.price,
        input.fees,
        input.currency,
        input.note ?? null,
        now,
        id
      );

    return getTransactionById(database, id);
  });
}

export function deleteTransaction(id: string) {
  return withDatabase((database) => {
    database.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
  });
}

export function replaceTransactions(inputs: TransactionInput[]) {
  return withDatabase((database) => {
    const now = new Date().toISOString();
    const insert = database.prepare(
      `INSERT INTO transactions
       (id, date, asset, asset_class, type, quantity, price, fees, currency, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    database.exec("BEGIN");
    try {
      for (const input of inputs) {
        const id = cryptoRandomId();
        insert.run(
          id,
          input.date,
          input.asset,
          input.assetClass,
          input.type,
          input.quantity,
          input.price,
          input.fees,
          input.currency,
          input.note ?? null,
          now,
          now
        );
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });
}

export function getSettings(): PortfolioSettings {
  return withDatabase((database) => {
    const row = database
      .prepare(`SELECT value FROM settings WHERE key = 'base_currency'`)
      .get() as { value?: string } | undefined;

    return {
      baseCurrency: row?.value ?? "USD"
    };
  });
}

export function updateBaseCurrency(baseCurrency: string) {
  return withDatabase((database) => {
    database
      .prepare(
        `INSERT INTO settings (key, value) VALUES ('base_currency', ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`
      )
      .run(baseCurrency.toUpperCase());
  });
}

export function getMarketCacheEntries() {
  return withDatabase((database) => {
    const rows = database
      .prepare(`SELECT cache_key, payload FROM market_cache`)
      .all() as Array<{ cache_key: string; payload: string }>;

    return Object.fromEntries(rows.map((row) => [row.cache_key, JSON.parse(row.payload)]));
  });
}

export function setMarketCacheEntries(entries: Record<string, unknown>) {
  return withDatabase((database) => {
    const insert = database.prepare(
      `INSERT INTO market_cache (cache_key, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
    );
    const now = new Date().toISOString();

    database.exec("BEGIN");
    try {
      Object.entries(entries).forEach(([key, value]) => {
        insert.run(key, JSON.stringify(value), now);
      });
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });
}

export function getHistoricalNavCache(cacheKey: string) {
  return withDatabase((database) => {
    const row = database
      .prepare(`SELECT payload, updated_at FROM historical_nav_cache WHERE cache_key = ?`)
      .get(cacheKey) as { payload?: string; updated_at?: string } | undefined;

    if (!row?.payload || !row.updated_at) {
      return null;
    }

    return {
      payload: JSON.parse(row.payload) as HistoricalNavResponse,
      updatedAt: row.updated_at
    };
  });
}

export function setHistoricalNavCache(
  cacheKey: string,
  payload: HistoricalNavResponse
) {
  return withDatabase((database) => {
    database
      .prepare(
        `INSERT INTO historical_nav_cache (cache_key, payload, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
      )
      .run(cacheKey, JSON.stringify(payload), new Date().toISOString());
  });
}

export function getBenchmarkPerformanceCache(cacheKey: string) {
  return withDatabase((database) => {
    const row = database
      .prepare(`SELECT payload, updated_at FROM benchmark_performance_cache WHERE cache_key = ?`)
      .get(cacheKey) as { payload?: string; updated_at?: string } | undefined;

    if (!row?.payload || !row.updated_at) {
      return null;
    }

    return {
      payload: JSON.parse(row.payload) as BenchmarkPerformanceResponse,
      updatedAt: row.updated_at
    };
  });
}

export function setBenchmarkPerformanceCache(
  cacheKey: string,
  payload: BenchmarkPerformanceResponse
) {
  return withDatabase((database) => {
    database
      .prepare(
        `INSERT INTO benchmark_performance_cache (cache_key, payload, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
      )
      .run(cacheKey, JSON.stringify(payload), new Date().toISOString());
  });
}

function getTransactionById(database: DatabaseSync, id: string) {
  const row = database
    .prepare(
      `SELECT id, date, asset, asset_class, type, quantity, price, fees, currency, note, created_at, updated_at
       FROM transactions WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;

  return row ? mapRowToTransaction(row) : null;
}

function mapRowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    date: String(row.date),
    asset: String(row.asset),
    assetClass: String(row.asset_class) as Transaction["assetClass"],
    type: String(row.type) as Transaction["type"],
    quantity: Number(row.quantity),
    price: Number(row.price),
    fees: Number(row.fees),
    currency: String(row.currency),
    note: row.note ? String(row.note) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function cryptoRandomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
