import { buildPortfolioState } from "@/lib/calculations/portfolio";
import { getSettings, listTransactions } from "@/lib/db";
import {
  fetchAndCacheMarketBundle,
  fetchHistoricalMarketBundle
} from "@/lib/marketData/server";
import { TIMEFRAME_CONFIG } from "@/lib/marketData/timeframes";
import { buildAssetKey, dedupeMarketAssets } from "@/lib/marketData/symbols";
import {
  CashBalance,
  HistoricalNavResponse,
  Holding,
  PortfolioHistoryPoint,
  PortfolioPayload,
  TimeframeKey
} from "@/types/portfolio";

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

  return {
    ok: true,
    timeframe,
    approximate: true,
    history,
    warnings: historicalBundle.warnings
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
