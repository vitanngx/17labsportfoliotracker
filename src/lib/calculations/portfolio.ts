import { ALLOCATION_COLORS } from "@/lib/portfolioConfig";
import { buildAssetKey } from "@/lib/marketData/symbols";
import {
  CashBalance,
  FxRate,
  Holding,
  MarketQuote,
  PortfolioHistoryPoint,
  PortfolioState,
  Transaction
} from "@/types/portfolio";

interface PositionState {
  asset: string;
  assetClass: Transaction["assetClass"];
  currency: string;
  quantity: number;
  costBasis: number;
  realizedPnl: number;
}

interface DailyState {
  positions: Map<string, PositionState>;
  cashBalances: Map<string, number>;
  dividendIncomeBase: number;
  realizedPnlBase: number;
}

export function buildPortfolioState(
  transactions: Transaction[],
  quotes: Record<string, MarketQuote>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string
): PortfolioState {
  const warnings: string[] = [];
  const ledger = replayTransactions(transactions, fxRates, baseCurrency, warnings);
  const holdings = buildHoldings(
    ledger.positions,
    quotes,
    fxRates,
    baseCurrency,
    warnings
  );
  const cashBalances = buildCashBalances(
    ledger.cashBalances,
    fxRates,
    baseCurrency,
    warnings
  );
  const totalHoldingsValueBase = holdings.reduce(
    (sum, holding) => sum + holding.marketValueBase,
    0
  );
  const totalCashValueBase = cashBalances.reduce(
    (sum, balance) => sum + balance.amountBase,
    0
  );
  const totalPortfolioValueBase = totalHoldingsValueBase + totalCashValueBase;
  const totalInvestedCapitalBase = holdings.reduce(
    (sum, holding) => sum + holding.costBasisBase,
    0
  );
  const totalUnrealizedPnlBase = holdings.reduce(
    (sum, holding) => sum + holding.unrealizedPnlBase,
    0
  );
  const totalReturnPct =
    totalInvestedCapitalBase > 0
      ? ((totalUnrealizedPnlBase + ledger.realizedPnlBase + ledger.dividendIncomeBase) /
          totalInvestedCapitalBase) *
        100
      : 0;

  const history = buildPortfolioHistory(
    transactions,
    quotes,
    fxRates,
    baseCurrency,
    warnings
  );
  const riskMetrics = computeRiskMetrics(history);

  assignWeights(holdings, totalPortfolioValueBase);
  assignCashWeights(cashBalances, totalPortfolioValueBase);

  return {
    holdings,
    cashBalances,
    summary: {
      baseCurrency,
      totalPortfolioValueBase,
      totalHoldingsValueBase,
      totalCashValueBase,
      totalInvestedCapitalBase,
      totalUnrealizedPnlBase,
      totalRealizedPnlBase: ledger.realizedPnlBase,
      totalDividendIncomeBase: ledger.dividendIncomeBase,
      totalReturnPct,
      allocationByAsset: buildAllocationByAsset(holdings, cashBalances),
      allocationByClass: buildAllocationByClass(holdings, cashBalances),
      sharpeRatio: riskMetrics.sharpeRatio,
      volatility: riskMetrics.volatility,
      maxDrawdownPct: computeMaxDrawdown(history)
    },
    history,
    warnings
  };
}

function replayTransactions(
  transactions: Transaction[],
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[]
) {
  const positions = new Map<string, PositionState>();
  const cashBalances = new Map<string, number>();
  let realizedPnlBase = 0;
  let dividendIncomeBase = 0;

  const sortedTransactions = [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return (left.createdAt ?? left.id).localeCompare(right.createdAt ?? right.id);
  });

  for (const transaction of sortedTransactions) {
    const key = buildAssetKey(transaction.asset, transaction.assetClass);
    const position = positions.get(key) ?? {
      asset: transaction.asset,
      assetClass: transaction.assetClass,
      currency: transaction.currency,
      quantity: 0,
      costBasis: 0,
      realizedPnl: 0
    };

    const gross = transaction.quantity * transaction.price;

    switch (transaction.type) {
      case "BUY": {
        position.quantity += transaction.quantity;
        position.costBasis += gross + transaction.fees;
        positions.set(key, position);
        adjustCash(cashBalances, transaction.currency, -(gross + transaction.fees));
        break;
      }
      case "SELL": {
        if (position.quantity <= 0) {
          warnings.push(
            `${transaction.asset}: SELL transaction has no available position. It was ignored.`
          );
          break;
        }

        const sellQuantity = Math.min(position.quantity, transaction.quantity);
        if (sellQuantity < transaction.quantity) {
          warnings.push(
            `${transaction.asset}: SELL quantity exceeded holdings. Only the available quantity was applied.`
          );
        }

        const averageCost =
          position.quantity > 0 ? position.costBasis / position.quantity : 0;
        const realized = sellQuantity * transaction.price - transaction.fees - averageCost * sellQuantity;
        position.realizedPnl += realized;
        position.quantity -= sellQuantity;
        position.costBasis = Math.max(0, position.costBasis - averageCost * sellQuantity);
        if (position.quantity <= 0.00000001) {
          position.quantity = 0;
          position.costBasis = 0;
        }
        positions.set(key, position);
        adjustCash(
          cashBalances,
          transaction.currency,
          sellQuantity * transaction.price - transaction.fees
        );
        realizedPnlBase +=
          realized * getFxRate(transaction.currency, baseCurrency, fxRates, warnings);
        break;
      }
      case "DIVIDEND": {
        adjustCash(cashBalances, transaction.currency, gross - transaction.fees);
        dividendIncomeBase +=
          (gross - transaction.fees) *
          getFxRate(transaction.currency, baseCurrency, fxRates, warnings);
        break;
      }
      case "CASH_IN": {
        adjustCash(cashBalances, transaction.currency, gross - transaction.fees);
        break;
      }
      case "CASH_OUT": {
        adjustCash(cashBalances, transaction.currency, -(gross + transaction.fees));
        break;
      }
      default:
        break;
    }
  }

  return {
    positions,
    cashBalances,
    realizedPnlBase,
    dividendIncomeBase
  };
}

function buildHoldings(
  positions: Map<string, PositionState>,
  quotes: Record<string, MarketQuote>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[]
): Holding[] {
  const holdings: Holding[] = [];

  for (const [key, position] of positions.entries()) {
    if (position.quantity <= 0 || position.assetClass === "CASH" || position.assetClass === "FX") {
      continue;
    }

    const quote = quotes[key];
    const fxRate = getFxRate(position.currency, baseCurrency, fxRates, warnings);
    const currentPrice = quote?.price ?? null;
    const marketValue = currentPrice === null ? 0 : currentPrice * position.quantity;
    const costBasis = position.costBasis;
    const unrealizedPnl = marketValue - costBasis;
    const marketValueBase = marketValue * fxRate;
    const costBasisBase = costBasis * fxRate;
    const unrealizedPnlBase = marketValueBase - costBasisBase;

    holdings.push({
      asset: position.asset,
      assetClass: position.assetClass,
      quantity: position.quantity,
      averageBuyPrice: position.quantity > 0 ? costBasis / position.quantity : 0,
      averageBuyPriceBase:
        position.quantity > 0 ? costBasisBase / position.quantity : 0,
      currentPrice,
      marketValue,
      marketValueBase,
      costBasis,
      costBasisBase,
      unrealizedPnl,
      unrealizedPnlBase,
      unrealizedPnlPct: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
      weightPct: 0,
      currency: position.currency,
      baseCurrency,
      lastUpdated: quote?.asOf ?? null,
      priceSource: quote?.source ?? "cache",
      priceProvider: quote?.provider ?? null,
      stalePrice: quote?.stale ?? true,
      fxRate
    });
  }

  return holdings.sort((left, right) => right.marketValueBase - left.marketValueBase);
}

function buildCashBalances(
  balances: Map<string, number>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[]
): CashBalance[] {
  return [...balances.entries()]
    .filter(([, amount]) => Math.abs(amount) > 0.0000001)
    .map(([currency, amount]) => {
      const fxRate = getFxRate(currency, baseCurrency, fxRates, warnings);
      return {
        currency,
        amount,
        amountBase: amount * fxRate,
        baseCurrency,
        weightPct: 0,
        fxRate
      };
    })
    .sort((left, right) => right.amountBase - left.amountBase);
}

function buildPortfolioHistory(
  transactions: Transaction[],
  quotes: Record<string, MarketQuote>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[],
  daysBack = 180
): PortfolioHistoryPoint[] {
  if (transactions.length === 0) {
    return [];
  }

  const sortedTransactions = [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return (left.createdAt ?? left.id).localeCompare(right.createdAt ?? right.id);
  });

  const txByDate = new Map<string, Transaction[]>();
  for (const transaction of sortedTransactions) {
    const bucket = txByDate.get(transaction.date) ?? [];
    bucket.push(transaction);
    txByDate.set(transaction.date, bucket);
  }

  const start = new Date(sortedTransactions[0].date);
  const earliestAllowed = new Date();
  earliestAllowed.setDate(earliestAllowed.getDate() - daysBack);
  if (start < earliestAllowed) {
    start.setTime(earliestAllowed.getTime());
  }

  const today = new Date();
  const state: DailyState = {
    positions: new Map(),
    cashBalances: new Map(),
    dividendIncomeBase: 0,
    realizedPnlBase: 0
  };
  const history: PortfolioHistoryPoint[] = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const dayTransactions = txByDate.get(dateKey) ?? [];

    for (const transaction of dayTransactions) {
      applyTransactionToDailyState(
        state,
        transaction,
        fxRates,
        baseCurrency,
        warnings
      );
    }

    const holdingsValueBase = computeHoldingsValueBase(
      state.positions,
      quotes,
      fxRates,
      baseCurrency,
      dateKey,
      warnings
    );
    const cashValueBase = computeCashValueBase(
      state.cashBalances,
      fxRates,
      baseCurrency,
      warnings
    );
    const investedCapitalBase = computeInvestedCapitalBase(
      state.positions,
      fxRates,
      baseCurrency,
      warnings
    );

    history.push({
      date: dateKey,
      investedCapitalBase,
      holdingsValueBase,
      cashValueBase,
      totalValueBase: holdingsValueBase + cashValueBase,
      unrealizedPnlBase: holdingsValueBase - investedCapitalBase,
      realizedPnlBase: state.realizedPnlBase,
      dividendIncomeBase: state.dividendIncomeBase
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return history.filter((point) => point.totalValueBase !== 0 || point.investedCapitalBase !== 0);
}

function applyTransactionToDailyState(
  state: DailyState,
  transaction: Transaction,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[]
) {
  const key = buildAssetKey(transaction.asset, transaction.assetClass);
  const position = state.positions.get(key) ?? {
    asset: transaction.asset,
    assetClass: transaction.assetClass,
    currency: transaction.currency,
    quantity: 0,
    costBasis: 0,
    realizedPnl: 0
  };
  const gross = transaction.quantity * transaction.price;

  switch (transaction.type) {
    case "BUY":
      position.quantity += transaction.quantity;
      position.costBasis += gross + transaction.fees;
      state.positions.set(key, position);
      adjustCash(state.cashBalances, transaction.currency, -(gross + transaction.fees));
      break;
    case "SELL": {
      const sellQuantity = Math.min(position.quantity, transaction.quantity);
      if (sellQuantity < transaction.quantity) {
        warnings.push(
          `${transaction.asset}: historical SELL quantity exceeded holdings and was capped.`
        );
      }
      const averageCost = position.quantity > 0 ? position.costBasis / position.quantity : 0;
      const realized = sellQuantity * transaction.price - transaction.fees - averageCost * sellQuantity;
      position.quantity -= sellQuantity;
      position.costBasis = Math.max(0, position.costBasis - averageCost * sellQuantity);
      if (position.quantity <= 0.00000001) {
        position.quantity = 0;
        position.costBasis = 0;
      }
      state.positions.set(key, position);
      adjustCash(state.cashBalances, transaction.currency, sellQuantity * transaction.price - transaction.fees);
      state.realizedPnlBase +=
        realized * getFxRate(transaction.currency, baseCurrency, fxRates, warnings);
      break;
    }
    case "DIVIDEND":
      adjustCash(state.cashBalances, transaction.currency, gross - transaction.fees);
      state.dividendIncomeBase +=
        (gross - transaction.fees) *
        getFxRate(transaction.currency, baseCurrency, fxRates, warnings);
      break;
    case "CASH_IN":
      adjustCash(state.cashBalances, transaction.currency, gross - transaction.fees);
      break;
    case "CASH_OUT":
      adjustCash(state.cashBalances, transaction.currency, -(gross + transaction.fees));
      break;
    default:
      break;
  }
}

function computeHoldingsValueBase(
  positions: Map<string, PositionState>,
  quotes: Record<string, MarketQuote>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  date: string,
  warnings: string[]
) {
  let total = 0;

  for (const [key, position] of positions.entries()) {
    if (position.quantity <= 0) {
      continue;
    }

    const quote = quotes[key];
    if (!quote) {
      continue;
    }
    const price = findHistoricalPrice(date, quote.history, quote.price ?? 0);
    const fxRate = getFxRate(position.currency, baseCurrency, fxRates, warnings);
    total += position.quantity * price * fxRate;
  }

  return total;
}

function computeCashValueBase(
  balances: Map<string, number>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[]
) {
  let total = 0;
  for (const [currency, amount] of balances.entries()) {
    total += amount * getFxRate(currency, baseCurrency, fxRates, warnings);
  }
  return total;
}

function computeInvestedCapitalBase(
  positions: Map<string, PositionState>,
  fxRates: Record<string, FxRate>,
  baseCurrency: string,
  warnings: string[]
) {
  let total = 0;
  for (const position of positions.values()) {
    total += position.costBasis * getFxRate(position.currency, baseCurrency, fxRates, warnings);
  }
  return total;
}

function getFxRate(
  currency: string,
  baseCurrency: string,
  fxRates: Record<string, FxRate>,
  warnings: string[]
) {
  if (currency.toUpperCase() === baseCurrency.toUpperCase()) {
    return 1;
  }

  const rate = fxRates[`${currency.toUpperCase()}:${baseCurrency.toUpperCase()}`]?.rate;
  if (!rate) {
    warnings.push(`Missing FX rate for ${currency}/${baseCurrency}; falling back to 1.0.`);
    return 1;
  }

  return rate;
}

function buildAllocationByAsset(holdings: Holding[], cashBalances: CashBalance[]) {
  const slices = holdings.map((holding, index) => ({
    name: holding.asset,
    value: holding.marketValueBase,
    weightPct: holding.weightPct,
    color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
  }));

  cashBalances.forEach((balance, index) => {
    slices.push({
      name: `Cash ${balance.currency}`,
      value: balance.amountBase,
      weightPct: balance.weightPct,
      color: ALLOCATION_COLORS[(holdings.length + index) % ALLOCATION_COLORS.length]
    });
  });

  return slices.sort((left, right) => right.value - left.value);
}

function buildAllocationByClass(holdings: Holding[], cashBalances: CashBalance[]) {
  const grouped = new Map<string, number>();

  holdings.forEach((holding) => {
    grouped.set(
      holding.assetClass,
      (grouped.get(holding.assetClass) ?? 0) + holding.marketValueBase
    );
  });

  if (cashBalances.length > 0) {
    grouped.set(
      "CASH",
      cashBalances.reduce((sum, balance) => sum + balance.amountBase, 0)
    );
  }

  const total = [...grouped.values()].reduce((sum, value) => sum + value, 0);

  return [...grouped.entries()].map(([name, value], index) => ({
    name: name.replaceAll("_", " "),
    value,
    weightPct: total > 0 ? (value / total) * 100 : 0,
    color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
  }));
}

function assignWeights(holdings: Holding[], totalPortfolioValueBase: number) {
  holdings.forEach((holding) => {
    holding.weightPct =
      totalPortfolioValueBase > 0
        ? (holding.marketValueBase / totalPortfolioValueBase) * 100
        : 0;
  });
}

function assignCashWeights(balances: CashBalance[], totalPortfolioValueBase: number) {
  balances.forEach((balance) => {
    balance.weightPct =
      totalPortfolioValueBase > 0
        ? (balance.amountBase / totalPortfolioValueBase) * 100
        : 0;
  });
}

function findHistoricalPrice(
  date: string,
  history: { date: string; close: number }[],
  fallbackPrice: number
) {
  if (history.length === 0) {
    return fallbackPrice;
  }

  let current = history[0].close;
  for (const point of history) {
    if (point.date > date) {
      return current;
    }
    current = point.close;
  }
  return current;
}

function computeRiskMetrics(history: PortfolioHistoryPoint[]) {
  if (history.length < 3) {
    return {
      sharpeRatio: null,
      volatility: null
    };
  }

  const returns: number[] = [];
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1].totalValueBase;
    const current = history[index].totalValueBase;
    if (previous <= 0 || current <= 0) {
      continue;
    }
    returns.push(current / previous - 1);
  }

  if (returns.length < 2) {
    return {
      sharpeRatio: null,
      volatility: null
    };
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (returns.length - 1);
  const dailyStdDev = Math.sqrt(variance);

  return {
    sharpeRatio: dailyStdDev > 0 ? (mean / dailyStdDev) * Math.sqrt(252) : null,
    volatility: dailyStdDev * Math.sqrt(252) * 100
  };
}

function computeMaxDrawdown(history: PortfolioHistoryPoint[]) {
  if (history.length === 0) {
    return null;
  }

  let peak = history[0].totalValueBase;
  let maxDrawdown = 0;

  history.forEach((point) => {
    if (point.totalValueBase > peak) {
      peak = point.totalValueBase;
    }
    if (peak > 0) {
      const drawdown = ((point.totalValueBase - peak) / peak) * 100;
      maxDrawdown = Math.min(maxDrawdown, drawdown);
    }
  });

  return maxDrawdown;
}

function adjustCash(balances: Map<string, number>, currency: string, delta: number) {
  balances.set(currency, (balances.get(currency) ?? 0) + delta);
}
