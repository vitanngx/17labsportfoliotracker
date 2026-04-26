import { AssetClass } from "@/types/portfolio";

export const STORAGE_KEYS = {
  transactions: "my-portfolio-tracker-transactions-v1",
  marketCache: "my-portfolio-tracker-market-cache-v1"
};

export const ASSET_CLASS_OPTIONS: Array<{
  value: AssetClass;
  label: string;
  defaultCurrency: string;
}> = [
  { value: "US_STOCK", label: "US Stock", defaultCurrency: "USD" },
  { value: "ETF", label: "ETF", defaultCurrency: "USD" },
  { value: "CRYPTO", label: "Crypto", defaultCurrency: "USD" },
  { value: "VN_STOCK", label: "Vietnam Stock", defaultCurrency: "VND" },
  { value: "CASH", label: "Cash", defaultCurrency: "USD" },
  { value: "OTHER", label: "Other", defaultCurrency: "USD" }
];

export const ALLOCATION_COLORS = [
  "#7BC7FF",
  "#F7C873",
  "#66D6A4",
  "#FF9B73",
  "#B6C2D0",
  "#FF7A7A",
  "#7EE5E4",
  "#8FA6FF"
];
