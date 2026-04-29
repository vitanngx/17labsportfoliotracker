import { buildPortfolioState } from "@/lib/calculations/portfolio";
import {
  getHistoricalNavCache,
  getSettings,
  listTransactions,
  setHistoricalNavCache
} from "@/lib/db";
import {
  fetchAndCacheMarketBundle,
  fetchHistoricalMarketBundle
} from "@/lib/marketData/server";
import { getTimeframeWindow, TIMEFRAME_CONFIG } from "@/lib/marketData/timeframes";
import { buildAssetKey, dedupeMarketAssets } from "@/lib/marketData/symbols";
import {
  BenchmarkKey,
  BenchmarkPerformancePoint,
  BenchmarkPerformanceResponse,
  BenchmarkSeriesInfo,
  CashBalance,
  HistoricalNavResponse,
  Holding,
  PortfolioHistoryPoint,
  PortfolioPayload,
  TimeframeKey
} from "@/types/portfolio";

const BENCHMARKS: Array<{
  key: Exclude<BenchmarkKey, "portfolio">;
  label: string;
  symbol: string;
  assetClass: "VN_STOCK" | "OTHER";
  currency: string;
  color: string;
}> = [
  {
    key: "vnIndex",
    label: "VNIndex",
    symbol: "VNINDEX",
    assetClass: "VN_STOCK",
    currency: "VND",
    color: "#F7C873"
  },
  {
    key: "sp500",
    label: "S&P 500",
    symbol: "^GSPC",
    assetClass: "OTHER",
    currency: "USD",
    color: "#7BC7FF"
  },
  {
    key: "cac40",
    label: "CAC 40",
    symbol: "^FCHI",
    assetClass: "OTHER",
    currency: "EUR",
    color: "#66D6A4"
  },
  {
    key: "cryptoMarketCap",
    label: "Crypto Total Market Cap",
    symbol: "CRYPTO_TOTAL_MARKET_CAP",
    assetClass: "OTHER",
    currency: "USD",
    color: "#FF9B73"
  }
];

export async function buildPortfolioPayload(isAdmin: boolean): Promise<PortfolioPayload> {
  const transactions = listTransactions();
  const settings = getSettings();
  const requestAssets = dedupeMarketAssets(
    transactions
      .filter((transaction) => transaction.type === "BUY" || transaction.type === "SELL")
      .map((transaction) => ({
        asset: transaction.asset,
        assetClass: transaction.assetClass,
        currency: transaction.currency
      }))
  );
  const bundle = await fetchAndCacheMarketBundle(requestAssets, settings.baseCurrency);
  const portfolio = buildPortfolioState(
    transactions,
    bundle.quotes,
    bundle.fxRates,
    settings.baseCurrency
  );

  return {
    portfolio,
    transactions,
    settings,
    marketWarnings: bundle.warnings,
    isAdmin
  };
}

export async function buildHistoricalNavPayload(
  timeframe: TimeframeKey
): Promise<HistoricalNavResponse> {
  const transactions = listTransactions();
  const settings = getSettings();
  const cacheKey = buildHistoricalNavCacheKey(
    timeframe,
    settings.baseCurrency,
    transactions
  );
  const cached = getFreshHistoricalNavCache(cacheKey, timeframe);

  if (cached) {
    return cached;
  }

  const requestAssets = dedupeMarketAssets(
    transactions
      .filter((transaction) => transaction.type === "BUY" || transaction.type === "SELL")
      .map((transaction) => ({
        asset: transaction.asset,
        assetClass: transaction.assetClass,
        currency: transaction.currency
      }))
  );

  if (requestAssets.length === 0) {
    return {
      ok: true,
      timeframe,
      approximate: true,
      history: [],
      warnings: []
    };
  }

  const currentBundle = await fetchAndCacheMarketBundle(requestAssets, settings.baseCurrency);
  const currentPortfolio = buildPortfolioState(
    transactions,
    currentBundle.quotes,
    currentBundle.fxRates,
    settings.baseCurrency
  );
  const config = TIMEFRAME_CONFIG[timeframe];
  const historicalBundle = await fetchHistoricalMarketBundle(
    requestAssets,
    settings.baseCurrency,
    config
  );
  const history = buildApproximateHistoricalNav(
    currentPortfolio.holdings,
    currentPortfolio.cashBalances,
    historicalBundle.quotes,
    historicalBundle.fxRates,
    settings.baseCurrency
  );
  const trimmedHistory = trimHistoryToTimeframe(history, timeframe);
  const payload = {
    ok: true,
    timeframe,
    approximate: true,
    history: trimmedHistory,
    warnings: historicalBundle.warnings
  } satisfies HistoricalNavResponse;

  setHistoricalNavCache(cacheKey, payload);

  return payload;
}

export async function buildBenchmarkPerformancePayload(
  timeframe: TimeframeKey
): Promise<BenchmarkPerformanceResponse> {
  const navPayload = await buildHistoricalNavPayload(timeframe);
  const config = TIMEFRAME_CONFIG[timeframe];
  const benchmarkAssets = BENCHMARKS.map((benchmark) => ({
    asset: benchmark.symbol,
    assetClass: benchmark.assetClass,
    currency: benchmark.currency
  }));
  const benchmarkBundle = await fetchHistoricalMarketBundle(
    benchmarkAssets,
    "USD",
    config
  );
  const benchmarkSeries = Object.fromEntries(
    BENCHMARKS.map((benchmark) => {
      const quote = benchmarkBundle.quotes[buildAssetKey(benchmark.symbol, benchmark.assetClass)];
      return [
        benchmark.key,
        normalizeReturnSeries(trimBenchmarkHistory(quote?.history ?? [], timeframe))
      ];
    })
  ) as Record<Exclude<BenchmarkKey, "portfolio">, Array<{ date: string; value: number }>>;
  const portfolioSeries = normalizeReturnSeries(
    navPayload.history.map((point) => ({
      date: point.date,
      close: point.totalValueBase
    }))
  );
  const history = mergeBenchmarkSeries({
    portfolio: portfolioSeries,
    ...benchmarkSeries
  });
  const series: BenchmarkSeriesInfo[] = [
    {
      key: "portfolio",
      label: "Portfolio",
      color: "#EDF2F7",
      available: portfolioSeries.length > 1
    },
    ...BENCHMARKS.map((benchmark) => ({
      key: benchmark.key,
      label: benchmark.label,
      color: benchmark.color,
      available: benchmarkSeries[benchmark.key].length > 1
    }))
  ];
  const missingWarnings = BENCHMARKS.flatMap((benchmark) =>
    benchmarkSeries[benchmark.key].length > 1
      ? []
      : [`${benchmark.label}: benchmark history unavailable for ${timeframe}.`]
  );

  return {
    ok: true,
    timeframe,
    history,
    series,
    warnings: [...benchmarkBundle.warnings, ...missingWarnings]
  };
}

function buildApproximateHistoricalNav(
  holdings: Holding[],
  cashBalances: CashBalance[],
  quotes: Record<string, { history: { date: string; close: number }[]; price: number | null }>,
  fxRates: Record<string, { history: { date: string; close: number }[]; rate: number | null }>,
  baseCurrency: string
): PortfolioHistoryPoint[] {
  const timestamps = collectHistoryTimestamps(quotes, fxRates);
  if (timestamps.length === 0) {
    return [];
  }

  const investedCapitalBase = holdings.reduce((sum, holding) => sum + holding.costBasisBase, 0);

  return timestamps
    .map((timestamp) => {
      let holdingsValueBase = 0;

      for (const holding of holdings) {
        const quote = quotes[buildAssetKey(holding.asset, holding.assetClass)];
        if (!quote) {
          continue;
        }

        const price = findHistoryValueAtTimestamp(
          timestamp,
          quote.history,
          quote.price ?? holding.currentPrice ?? 0
        );
        const fxRate =
          holding.currency.toUpperCase() === baseCurrency.toUpperCase()
            ? 1
            : findFxRateAtTimestamp(
                timestamp,
                fxRates[`${holding.currency.toUpperCase()}:${baseCurrency.toUpperCase()}`]
              );

        holdingsValueBase += holding.quantity * price * fxRate;
      }

      const cashValueBase = cashBalances.reduce((sum, balance) => {
        const fxRate =
          balance.currency.toUpperCase() === baseCurrency.toUpperCase()
            ? 1
            : findFxRateAtTimestamp(
                timestamp,
                fxRates[`${balance.currency.toUpperCase()}:${baseCurrency.toUpperCase()}`]
              );

        return sum + balance.amount * fxRate;
      }, 0);

      return {
        date: timestamp,
        investedCapitalBase,
        holdingsValueBase,
        cashValueBase,
        totalValueBase: holdingsValueBase + cashValueBase,
        unrealizedPnlBase: holdingsValueBase + cashValueBase - investedCapitalBase,
        realizedPnlBase: 0,
        dividendIncomeBase: 0
      };
    })
    .filter((point) => Number.isFinite(point.totalValueBase));
}

function collectHistoryTimestamps(
  quotes: Record<string, { history: { date: string; close: number }[] }>,
  fxRates: Record<string, { history: { date: string; close: number }[] }>
) {
  const points = new Set<string>();

  Object.values(quotes).forEach((quote) => {
    quote.history.forEach((point) => points.add(point.date));
  });

  Object.values(fxRates).forEach((rate) => {
    rate.history.forEach((point) => points.add(point.date));
  });

  return [...points].sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
}

function findHistoryValueAtTimestamp(
  timestamp: string,
  history: { date: string; close: number }[],
  fallback: number
) {
  if (history.length === 0) {
    return fallback;
  }

  let current = history[0].close;
  const targetTime = new Date(timestamp).getTime();

  for (const point of history) {
    if (new Date(point.date).getTime() > targetTime) {
      return current;
    }
    current = point.close;
  }

  return current;
}

function findFxRateAtTimestamp(
  timestamp: string,
  fxRate:
    | {
        history: { date: string; close: number }[];
        rate: number | null;
      }
    | undefined
) {
  if (!fxRate) {
    return 1;
  }

  return findHistoryValueAtTimestamp(timestamp, fxRate.history, fxRate.rate ?? 1);
}

function trimHistoryToTimeframe(
  history: PortfolioHistoryPoint[],
  timeframe: TimeframeKey
) {
  const { start, end } = getTimeframeWindow(timeframe);

  return history.filter((point) => {
    const timestamp = new Date(point.date).getTime();
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  });
}

function trimBenchmarkHistory(
  history: { date: string; close: number }[],
  timeframe: TimeframeKey
) {
  const { start, end } = getTimeframeWindow(timeframe);

  return history.filter((point) => {
    const timestamp = new Date(point.date).getTime();
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  });
}

function normalizeReturnSeries(history: { date: string; close: number }[]) {
  const validHistory = history.filter((point) => Number.isFinite(point.close) && point.close > 0);
  const baseline = validHistory[0]?.close;

  if (!baseline) {
    return [];
  }

  return validHistory.map((point) => ({
    date: point.date,
    value: ((point.close - baseline) / baseline) * 100
  }));
}

function mergeBenchmarkSeries(
  series: Record<BenchmarkKey, Array<{ date: string; value: number }>>
): BenchmarkPerformancePoint[] {
  const timestamps = Array.from(
    new Set(Object.values(series).flatMap((points) => points.map((point) => point.date)))
  ).sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

  const cursors = Object.fromEntries(
    Object.keys(series).map((key) => [key, 0])
  ) as Record<BenchmarkKey, number>;
  const latestValues = {} as Record<BenchmarkKey, number | null>;

  return timestamps.map((timestamp) => {
    const point: BenchmarkPerformancePoint = { date: timestamp };

    (Object.keys(series) as BenchmarkKey[]).forEach((key) => {
      const points = series[key];
      let cursor = cursors[key] ?? 0;

      while (
        cursor < points.length &&
        new Date(points[cursor].date).getTime() <= new Date(timestamp).getTime()
      ) {
        latestValues[key] = points[cursor].value;
        cursor += 1;
      }

      cursors[key] = cursor;
      point[key] = latestValues[key] ?? null;
    });

    return point;
  });
}

function getFreshHistoricalNavCache(cacheKey: string, timeframe: TimeframeKey) {
  const cached = getHistoricalNavCache(cacheKey);
  if (!cached) {
    return null;
  }

  const updatedAt = new Date(cached.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return null;
  }

  if (Date.now() - updatedAt > getHistoricalNavCacheTtlMs(timeframe)) {
    return null;
  }

  return cached.payload;
}

function getHistoricalNavCacheTtlMs(timeframe: TimeframeKey) {
  const minutesByTimeframe: Record<TimeframeKey, number> = {
    "1D": 2,
    "7D": 5,
    "1M": 15,
    "3M": 30,
    "1Y": 180
  };

  return minutesByTimeframe[timeframe] * 60 * 1000;
}

function buildHistoricalNavCacheKey(
  timeframe: TimeframeKey,
  baseCurrency: string,
  transactions: Array<{ id: string; updatedAt?: string }>
) {
  const fingerprint = transactions
    .map((transaction) => `${transaction.id}:${transaction.updatedAt ?? ""}`)
    .join("|");

  return [
    "historical-nav",
    baseCurrency.toUpperCase(),
    timeframe,
    hashString(fingerprint)
  ].join(":");
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
