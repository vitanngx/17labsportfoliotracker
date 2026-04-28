import { ASSET_NAMES } from "@/lib/assets/assetName";

export function getAssetDisplayName(asset: string) {
  const normalized = asset.trim().toUpperCase();
  const variants = [
    normalized,
    `${normalized}.VN`,
    `${normalized}.PA`,
    `${normalized}-USD`,
    normalized.replace(/\.VN$/, ""),
    normalized.replace(/\.PA$/, ""),
    normalized.replace(/-USD$/, "")
  ];

  for (const variant of variants) {
    const name = ASSET_NAMES[variant];
    if (name) {
      return name;
    }
  }

  return asset;
}
