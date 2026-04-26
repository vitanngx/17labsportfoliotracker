import { buildPortfolioState } from "@/lib/calculations/portfolio";
import { getSettings, listTransactions } from "@/lib/db";
import { fetchAndCacheMarketBundle } from "@/lib/marketData/server";
import { dedupeMarketAssets } from "@/lib/marketData/symbols";
import { PortfolioPayload } from "@/types/portfolio";

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
