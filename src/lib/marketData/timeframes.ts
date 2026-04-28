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

export function getTimeframeWindow(timeframe: TimeframeKey, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);

  switch (timeframe) {
    case "1D":
      start.setHours(start.getHours() - 24);
      break;
    case "7D":
      start.setDate(start.getDate() - 7);
      break;
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "1Y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      break;
  }

  return {
    start,
    end
  };
}
