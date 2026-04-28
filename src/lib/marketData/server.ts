import { spawn } from "node:child_process";
import path from "node:path";
import { buildAssetKey } from "@/lib/marketData/symbols";
import { getMarketCacheEntries, setMarketCacheEntries } from "@/lib/db";
import {
  FxRate,
  MarketDataResponse,
  MarketQuote,
  MarketRequestAsset,
  QuoteSource
} from "@/types/portfolio";

export async function fetchAndCacheMarketBundle(
  assets: MarketRequestAsset[],
  baseCurrency: string
) {
  const cachedQuotes = getMarketCacheEntries() as Record<string, MarketQuote>;
  const uniqueAssets = dedupeByKey(assets, (asset) =>
    buildAssetKey(asset.asset, asset.assetClass)
  );
  const fxRequests = buildFxRequests(uniqueAssets, baseCurrency);
  const fxAssets = dedupeByKey(
    fxRequests.flatMap((request) => [
      {
        asset: request.symbol,
        assetClass: "FX" as const,
        currency: request.quoteCurrency
      },
      {
        asset: request.inverseSymbol,
        assetClass: "FX" as const,
        currency: request.fromCurrency
      }
    ]),
    (asset) => buildAssetKey(asset.asset, asset.assetClass)
  );
  const response = await runPythonBridge([...uniqueAssets, ...fxAssets]);

  const warnings: string[] = [...response.errors];
  const quotes: Record<string, MarketQuote> = {};
  const cacheUpdates: Record<string, MarketQuote> = {};
  const fxRates: Record<string, FxRate> = {};

  for (const asset of uniqueAssets) {
    const key = buildAssetKey(asset.asset, asset.assetClass);
    const live = response.quotes[key];
    const cached = cachedQuotes[key];
    const merged = mergeQuoteWithCache(asset, live, cached, warnings);
    quotes[key] = merged;
    cacheUpdates[key] = merged;
  }

  for (const request of fxRequests) {
    const directKey = buildAssetKey(request.symbol, "FX");
    const inverseKey = buildAssetKey(request.inverseSymbol, "FX");
    const direct = response.quotes[directKey];
    const inverse = response.quotes[inverseKey];
    const rate = computeFxRate(request.fromCurrency, request.toCurrency, direct, inverse);
    fxRates[`${request.fromCurrency}:${request.toCurrency}`] = rate;
  }

  setMarketCacheEntries(cacheUpdates);

  return {
    quotes,
    fxRates,
    warnings
  };
}

export async function fetchHistoricalMarketBundle(
  assets: MarketRequestAsset[],
  baseCurrency: string,
  options: { range: string; interval: string }
) {
  const cachedQuotes = getMarketCacheEntries() as Record<string, MarketQuote>;
  const uniqueAssets = dedupeByKey(assets, (asset) =>
    buildAssetKey(asset.asset, asset.assetClass)
  );
  const fxRequests = buildFxRequests(uniqueAssets, baseCurrency);
  const fxAssets = dedupeByKey(
    fxRequests.flatMap((request) => [
      {
        asset: request.symbol,
        assetClass: "FX" as const,
        currency: request.quoteCurrency
      },
      {
        asset: request.inverseSymbol,
        assetClass: "FX" as const,
        currency: request.fromCurrency
      }
    ]),
    (asset) => buildAssetKey(asset.asset, asset.assetClass)
  );
  const response = await runPythonBridge([...uniqueAssets, ...fxAssets], options);

  const warnings: string[] = [...response.errors];
  const quotes: Record<string, MarketQuote> = {};
  const fxRates: Record<string, FxRate> = {};

  for (const asset of uniqueAssets) {
    const key = buildAssetKey(asset.asset, asset.assetClass);
    quotes[key] = mergeQuoteWithCache(asset, response.quotes[key], cachedQuotes[key], warnings);
  }

  for (const request of fxRequests) {
    const directKey = buildAssetKey(request.symbol, "FX");
    const inverseKey = buildAssetKey(request.inverseSymbol, "FX");
    const direct = response.quotes[directKey];
    const inverse = response.quotes[inverseKey];
    fxRates[`${request.fromCurrency}:${request.toCurrency}`] = computeFxRate(
      request.fromCurrency,
      request.toCurrency,
      direct,
      inverse
    );
  }

  return {
    quotes,
    fxRates,
    warnings
  };
}

async function runPythonBridge(
  assets: MarketRequestAsset[],
  options?: { range?: string; interval?: string }
): Promise<MarketDataResponse> {
  if (assets.length === 0) {
    return {
      ok: true,
      quotes: {},
      errors: []
    };
  }

  const scriptPath = path.join(process.cwd(), "python", "market_data.py");
  const payload = JSON.stringify({
    assets,
    daysBack: 180,
    range: options?.range,
    interval: options?.interval
  });

  return new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python bridge exited with code ${code}`));
        return;
      }

      try {
        resolve(parseMarketDataResponse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

function parseMarketDataResponse(stdout: string): MarketDataResponse {
  const trimmed = stdout.trim();

  try {
    return JSON.parse(trimmed) as MarketDataResponse;
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(lines[index]) as MarketDataResponse;
      } catch {
        continue;
      }
    }
  }

  throw new Error("Unable to parse market data response.");
}

function mergeQuoteWithCache(
  asset: MarketRequestAsset,
  liveQuote: MarketQuote | undefined,
  cachedQuote: MarketQuote | undefined,
  warnings: string[]
) {
  if (liveQuote?.price !== null && liveQuote?.price !== undefined) {
    return {
      ...liveQuote,
      source: "live" as QuoteSource,
      stale: false
    };
  }

  if (cachedQuote?.price !== null && cachedQuote?.price !== undefined) {
    warnings.push(
      `${asset.asset}: live quote unavailable, using last known cached market price.`
    );

    return {
      ...cachedQuote,
      source: "cache" as QuoteSource,
      stale: true
    };
  }

  warnings.push(`${asset.asset}: no live quote or cached fallback available.`);

  return {
    asset: asset.asset,
    assetClass: asset.assetClass,
    currency: asset.currency,
    price: null,
    previousClose: null,
    asOf: null,
    provider: null,
    source: "cache" as QuoteSource,
    stale: true,
    history: [],
    error: liveQuote?.error ?? "No live quote or cache entry available."
  };
}

function buildFxRequests(assets: MarketRequestAsset[], baseCurrency: string) {
  const currencies = [...new Set(assets.map((asset) => asset.currency.toUpperCase()))].filter(
    (currency) => currency !== baseCurrency.toUpperCase()
  );

  return currencies.map((currency) => ({
    fromCurrency: currency,
    toCurrency: baseCurrency.toUpperCase(),
    symbol: `${currency}${baseCurrency.toUpperCase()}=X`,
    inverseSymbol: `${baseCurrency.toUpperCase()}${currency}=X`,
    quoteCurrency: baseCurrency.toUpperCase()
  }));
}

function computeFxRate(
  fromCurrency: string,
  toCurrency: string,
  directQuote: MarketQuote | undefined,
  inverseQuote: MarketQuote | undefined
): FxRate {
  const directPrice = directQuote?.price ?? null;
  if (directPrice && directPrice > 0) {
    return {
      pair: `${fromCurrency}/${toCurrency}`,
      fromCurrency,
      toCurrency,
      rate: directPrice,
      inverse: false,
      asOf: directQuote?.asOf ?? null,
      provider: directQuote?.provider ?? null,
      source: directQuote?.source ?? "live",
      stale: directQuote?.stale ?? false,
      history: directQuote?.history ?? []
    };
  }

  const inversePrice = inverseQuote?.price ?? null;
  if (inversePrice && inversePrice > 0) {
    return {
      pair: `${fromCurrency}/${toCurrency}`,
      fromCurrency,
      toCurrency,
      rate: 1 / inversePrice,
      inverse: true,
      asOf: inverseQuote?.asOf ?? null,
      provider: inverseQuote?.provider ?? null,
      source: inverseQuote?.source ?? "live",
      stale: inverseQuote?.stale ?? false,
      history: inverseQuote?.history ?? []
    };
  }

  return {
    pair: `${fromCurrency}/${toCurrency}`,
    fromCurrency,
    toCurrency,
    rate: null,
    inverse: false,
    asOf: null,
    provider: null,
    source: "cache",
    stale: true,
    history: [],
    error: `No FX rate found for ${fromCurrency}/${toCurrency}.`
  };
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
