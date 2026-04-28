"use client";

import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent
} from "@/lib/formatters";
import { TIMEFRAME_CONFIG } from "@/lib/marketData/timeframes";
import {
  HistoricalNavResponse,
  PortfolioHistoryPoint,
  TimeframeKey
} from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";

interface PerformanceChartProps {
  currency: string;
  className?: string;
}

const TIMEFRAMES = Object.keys(TIMEFRAME_CONFIG) as TimeframeKey[];

export default function PerformanceChart({
  currency,
  className = ""
}: PerformanceChartProps) {
  const [activeTimeframe, setActiveTimeframe] = React.useState<TimeframeKey>("7D");
  const [chartData, setChartData] = React.useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/portfolio/history?timeframe=${activeTimeframe}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json()) as HistoricalNavResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to load historical NAV.");
        }

        setChartData(payload.history);
        setWarnings(payload.warnings);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setChartData([]);
        setWarnings([]);
        setError(
          fetchError instanceof Error ? fetchError.message : "Unable to load historical NAV."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      controller.abort();
    };
  }, [activeTimeframe]);

  const performanceIndicators = React.useMemo(
    () => [
      { label: "Today", value: computePeriodReturn(chartData, 1) },
      { label: "7D", value: computePeriodReturn(chartData, 7) },
      { label: "30D", value: computePeriodReturn(chartData, 30) }
    ],
    [chartData]
  );

  return (
    <SectionCard
      title="Portfolio Value"
      subtitle="Approximate historical NAV built from current holdings, cash balances, and timeframe-specific market data."
      className={`chart-shell p-5 md:p-5 ${className}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((timeframe) => {
            const isActive = timeframe === activeTimeframe;

            return (
              <button
                key={timeframe}
                type="button"
                onClick={() => setActiveTimeframe(timeframe)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] transition-all ${
                  isActive
                    ? "border border-accent/40 bg-accent/15 text-ink shadow-[0_0_0_1px_rgba(120,201,255,0.08)]"
                    : "border border-line bg-white/[0.02] text-mist hover:border-accent/30 hover:text-ink"
                }`}
              >
                {timeframe}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {performanceIndicators.map((indicator) => (
            <div
              key={indicator.label}
              className="rounded-2xl border border-line bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mist">
                {indicator.label}
              </p>
              <p
                className={`mt-1 mono text-sm ${
                  indicator.value === null
                    ? "text-mist"
                    : indicator.value >= 0
                      ? "text-positive"
                      : "text-negative"
                }`}
              >
                {indicator.value === null ? "N/A" : formatPercent(indicator.value)}
              </p>
            </div>
          ))}
        </div>
        {warnings.length > 0 ? <p className="text-xs text-mist">{warnings[0]}</p> : null}
        <div className="h-[236px] transition-all duration-300">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-[22px] border border-line bg-white/[0.02] text-sm text-mist">
              Loading {activeTimeframe} NAV...
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-line bg-white/[0.02] px-6 text-center text-sm text-mist">
              {error}
            </div>
          ) : chartData.length < 2 ? (
            <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-line bg-white/[0.02] px-6 text-center text-sm text-mist">
              No approximate NAV data is available for the selected timeframe yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#78C9FF" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#78C9FF" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  minTickGap={28}
                  tickMargin={8}
                  tickFormatter={(value) => formatAxisLabel(String(value), activeTimeframe)}
                />
                <YAxis
                  width={82}
                  tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(7, 11, 17, 0.96)",
                    border: "1px solid rgba(151, 171, 190, 0.18)",
                    borderRadius: "16px",
                    color: "#edf2f7"
                  }}
                  itemStyle={{ color: "#edf2f7" }}
                  labelStyle={{ color: "#edf2f7" }}
                  formatter={(value: number) => formatCurrency(Number(value), currency)}
                  labelFormatter={(label) => formatTooltipLabel(String(label), activeTimeframe)}
                />
                <Area
                  type="monotone"
                  dataKey="totalValueBase"
                  stroke="#78C9FF"
                  strokeWidth={2}
                  fill="url(#portfolioArea)"
                  isAnimationActive
                  animationDuration={260}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function computePeriodReturn(data: PortfolioHistoryPoint[], days: number) {
  if (data.length < 2) {
    return null;
  }

  const latest = data[data.length - 1];
  const latestDate = new Date(latest.date);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - days);

  const baseline = data.find((point) => new Date(point.date) >= cutoff) ?? data[0];
  if (baseline.totalValueBase === 0) {
    return null;
  }

  return ((latest.totalValueBase - baseline.totalValueBase) / baseline.totalValueBase) * 100;
}

function formatAxisLabel(value: string, timeframe: TimeframeKey) {
  const date = new Date(value);

  if (timeframe === "1D") {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  if (timeframe === "7D") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit"
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatTooltipLabel(value: string, timeframe: TimeframeKey) {
  const date = new Date(value);

  if (timeframe === "1D" || timeframe === "7D" || timeframe === "1M") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}
