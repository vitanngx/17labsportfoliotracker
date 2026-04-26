import { AssetClass, MarketRequestAsset } from "@/types/portfolio";

export function buildAssetKey(asset: string, assetClass: AssetClass): string {
  return `${assetClass}:${asset.trim().toUpperCase()}`;
}

export function normalizeAssetInput(
  asset: string,
  assetClass: AssetClass
): string {
  const raw = asset.trim().toUpperCase();

  if (assetClass === "CRYPTO") {
    if (raw.includes("/")) {
      return raw.replace("/", "-");
    }

    if (raw.includes("-")) {
      return raw;
    }

    return `${raw}-USD`;
  }

  return raw;
}

export function dedupeMarketAssets(
  transactions: MarketRequestAsset[]
): MarketRequestAsset[] {
  const seen = new Set<string>();

  return transactions.filter((transaction) => {
    const key = buildAssetKey(transaction.asset, transaction.assetClass);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
