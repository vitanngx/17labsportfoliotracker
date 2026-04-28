import { TimeframeKey } from "@/types/portfolio";

export const TIMEFRAME_CONFIG: Record<
  TimeframeKey,
  { range: string; interval: string }
> = {
  "1D": { range: "1d", interval: "15m" },
  "7D": { range: "7d", interval: "1h" },
  "1M": { range: "1mo", interval: "4h" },
  "3M": { range: "3mo", interval: "1d" },
  "1Y": { range: "1y", interval: "3d" }
};
