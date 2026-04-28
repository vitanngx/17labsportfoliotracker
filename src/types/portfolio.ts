export type AssetClass =
  | "US_STOCK"
  | "FR_STOCK"
  | "ETF"
  | "CRYPTO"
  | "VN_STOCK"
  | "CASH"
  | "OTHER"
  | "FX";

export type TransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "CASH_IN"
  | "CASH_OUT";

export type QuoteSource = "live" | "cache";

export interface Transaction {
  id: string;
  date: string;
  asset: string;
  assetClass: AssetClass;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionInput = Omit<
  Transaction,
  "id" | "createdAt" | "updatedAt"
>;

export interface MarketHistoryPoint {
  date: string;
  close: number;
}

export interface MarketQuote {
  asset: string;
  assetClass: AssetClass;
  currency: string;
  price: number | null;
  previousClose: number | null;
  asOf: string | null;
  provider: string | null;
  source: QuoteSource;
  stale: boolean;
  history: MarketHistoryPoint[];
  error?: string;
}

export interface FxRate {
  pair: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number | null;
  inverse: boolean;
  asOf: string | null;
  provider: string | null;
  source: QuoteSource;
  stale: boolean;
  history: MarketHistoryPoint[];
  error?: string;
}

export interface MarketRequestAsset {
  asset: string;
  assetClass: AssetClass;
  currency: string;
}

export interface MarketDataResponse {
  ok: boolean;
  quotes: Record<string, MarketQuote>;
  errors: string[];
}

export interface Holding {
  asset: string;
  assetClass: AssetClass;
  quantity: number;
  averageBuyPrice: number;
  averageBuyPriceBase: number;
  currentPrice: number | null;
  marketValue: number;
  marketValueBase: number;
  costBasis: number;
  costBasisBase: number;
  unrealizedPnl: number;
  unrealizedPnlBase: number;
  unrealizedPnlPct: number;
  weightPct: number;
  currency: string;
  baseCurrency: string;
  lastUpdated: string | null;
  priceSource: QuoteSource;
  priceProvider: string | null;
  stalePrice: boolean;
  fxRate: number | null;
}

export interface CashBalance {
  currency: string;
  amount: number;
  amountBase: number;
  baseCurrency: string;
  weightPct: number;
  fxRate: number | null;
}

export interface AllocationSlice {
  name: string;
  value: number;
  weightPct: number;
  color: string;
}

export interface PortfolioHistoryPoint {
  date: string;
  investedCapitalBase: number;
  holdingsValueBase: number;
  cashValueBase: number;
  totalValueBase: number;
  unrealizedPnlBase: number;
  realizedPnlBase: number;
  dividendIncomeBase: number;
}

export type TimeframeKey = "1D" | "7D" | "1M" | "3M" | "1Y";

export interface HistoricalNavResponse {
  ok: boolean;
  timeframe: TimeframeKey;
  approximate: boolean;
  history: PortfolioHistoryPoint[];
  warnings: string[];
  error?: string;
}

export interface PortfolioSummary {
  baseCurrency: string;
  totalPortfolioValueBase: number;
  totalHoldingsValueBase: number;
  totalCashValueBase: number;
  grossExposureBase: number;
  totalInvestedCapitalBase: number;
  totalUnrealizedPnlBase: number;
  totalRealizedPnlBase: number;
  totalDividendIncomeBase: number;
  totalReturnPct: number;
  allocationByAsset: AllocationSlice[];
  allocationByClass: AllocationSlice[];
  sharpeRatio: number | null;
  volatility: number | null;
  maxDrawdownPct: number | null;
}

export interface PortfolioState {
  holdings: Holding[];
  cashBalances: CashBalance[];
  summary: PortfolioSummary;
  history: PortfolioHistoryPoint[];
  warnings: string[];
}

export interface PortfolioSettings {
  baseCurrency: string;
}

export interface PortfolioPayload {
  portfolio: PortfolioState;
  transactions: Transaction[];
  settings: PortfolioSettings;
  marketWarnings: string[];
  isAdmin: boolean;
}

export interface CrudResponse<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface CsvImportRow {
  date: string;
  asset: string;
  assetClass: AssetClass;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  note?: string;
}
