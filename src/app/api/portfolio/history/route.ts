import { NextRequest, NextResponse } from "next/server";
import { buildHistoricalNavPayload } from "@/lib/portfolioService";
import { TimeframeKey } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES = new Set<TimeframeKey>(["1D", "7D", "1M", "3M", "1Y"]);

export async function GET(request: NextRequest) {
  const timeframeParam = request.nextUrl.searchParams.get("timeframe")?.toUpperCase() as
    | TimeframeKey
    | undefined;
  const timeframe = VALID_TIMEFRAMES.has(timeframeParam ?? "7D")
    ? (timeframeParam as TimeframeKey)
    : "7D";

  try {
    const payload = await buildHistoricalNavPayload(timeframe);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        timeframe,
        approximate: true,
        history: [],
        warnings: [],
        error: error instanceof Error ? error.message : "Unable to build historical NAV."
      },
      { status: 500 }
    );
  }
}
