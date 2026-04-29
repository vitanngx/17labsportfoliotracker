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
import { getTimeframeWindow, TIMEFRAME_CONFIG } from "@/lib/marketData/timeframes";
import {
  HistoricalNavResponse,
  PortfolioHistoryPoint,
  TimeframeKey
} from "@/types/portfolio";
import { useI18n } from "@/components/I18nProvider";

interface PerformanceChartProps {
  currency: string;
  className?: string;
}

const TIMEFRAMES = Object.keys(TIMEFRAME_CONFIG) as TimeframeKey[];

export default function PerformanceChart({
  currency,
  className = ""
}: PerformanceChartProps) {
  const { t, intlLocale } = useI18n();
  const [activeTimeframe, setActiveTimeframe] = React.useState<TimeframeKey>("7D");
  const [chartData, setChartData] = React.useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const filteredChartData = React.useMemo(
    () => trimChartDataToTimeframe(chartData, activeTimeframe),
    [activeTimeframe, chartData]
  );
  const chartSeries = React.useMemo(
    () =>
      filteredChartData.map((point) => ({
        ...point,
        timestamp: new Date(point.date).getTime()
      })),
    [filteredChartData]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError(null);
      setChartData([]);
      setWarnings([]);

      try {
        const response = await fetch(`/api/portfolio/history?timeframe=${activeTimeframe}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json()) as HistoricalNavResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(t("chart.loadHistoryError"));
        }

        setChartData(payload.history);
        setWarnings(payload.warnings);

        if (process.env.NODE_ENV !== "production") {
          console.log(
            activeTimeframe,
            payload.history[0]?.date,
            payload.history[payload.history.length - 1]?.date
          );
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setChartData([]);
        setWarnings([]);
        setError(
          fetchError instanceof Error ? fetchError.message : t("chart.loadHistoryError")
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
  }, [activeTimeframe, t]);

  const performanceIndicators = React.useMemo(
    () => [
      { label: t("chart.today"), value: computePeriodReturn(filteredChartData, 1) },
      { label: "7D", value: computePeriodReturn(filteredChartData, 7) },
      { label: "30D", value: computePeriodReturn(filteredChartData, 30) }
    ],
    [filteredChartData, t]
  );

  return (
    <section className={`surface-panel chart-shell flex h-full flex-col rounded-[28px] p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-title text-mist">{t("sections.portfolioValue")}</p>
        </div>
        <div className="flex rounded-full border border-line bg-black/20 p-1">
          {TIMEFRAMES.map((timeframe) => {
            const isActive = timeframe === activeTimeframe;

            return (
              <button
                key={timeframe}
                type="button"
                onClick={() => setActiveTimeframe(timeframe)}
                className={`h-8 min-w-12 rounded-full px-3 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-ink text-[#080d14] shadow-[0_8px_22px_rgba(237,242,247,0.16)]"
                    : "text-mist hover:bg-white/[0.05] hover:text-ink"
                }`}
              >
                {timeframe}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {performanceIndicators.map((indicator) => (
          <div
            key={indicator.label}
            className="flex items-center gap-2 rounded-full border border-line bg-white/[0.02] px-3 py-1.5"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
              {indicator.label}
            </span>
            <span
              className={`mono text-xs ${
                indicator.value === null
                  ? "text-mist"
                  : indicator.value >= 0
                    ? "text-positive"
                    : "text-negative"
              }`}
            >
              {indicator.value === null ? t("common.notAvailable") : formatPercent(indicator.value, 2, intlLocale)}
            </span>
          </div>
        ))}
        {warnings.length > 0 ? (
          <div className="min-w-0 flex-1 truncate text-xs text-mist">
            {warnings[0]}
          </div>
        ) : null}
      </div>

      <div className="mt-4 h-[248px] transition-all duration-300">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-[18px] border border-line bg-white/[0.02] text-sm text-mist">
              {t("chart.loadingNav", { timeframe: activeTimeframe })}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-line bg-white/[0.02] px-6 text-center text-sm text-mist">
              {error}
            </div>
          ) : chartSeries.length < 2 ? (
            <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-line bg-white/[0.02] px-6 text-center text-sm text-mist">
              {t("chart.emptyNav")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#78C9FF" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#78C9FF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  minTickGap={28}
                  tickMargin={8}
                  tickFormatter={(value) => formatAxisLabel(Number(value), activeTimeframe, intlLocale)}
                />
                <YAxis
                  width={82}
                  tickFormatter={(value) => formatCompactCurrency(Number(value), currency, intlLocale)}
                />
                <Tooltip
                  cursor={{
                    stroke: "rgba(237, 242, 247, 0.24)",
                    strokeDasharray: "4 4"
                  }}
                  content={(props) => (
                    <NavTooltip
                      {...props}
                      currency={currency}
                      timeframe={activeTimeframe}
                      locale={intlLocale}
                      navLabel={t("chart.nav")}
                      notAvailableLabel={t("common.notAvailable")}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="totalValueBase"
                  stroke="#78C9FF"
                  strokeWidth={2}
                  fill="url(#portfolioArea)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#edf2f7",
                    fill: "#78C9FF"
                  }}
                  isAnimationActive
                  animationDuration={260}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
      </div>
    </section>
  );
}

function trimChartDataToTimeframe(
  data: PortfolioHistoryPoint[],
  timeframe: TimeframeKey
) {
  const { start, end } = getTimeframeWindow(timeframe);

  return data.filter((point) => {
    const timestamp = new Date(point.date).getTime();
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  });
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

function formatAxisLabel(value: number, timeframe: TimeframeKey, locale: string) {
  const date = new Date(value);

  if (timeframe === "1D") {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  if (timeframe === "7D") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric"
    }).format(date);
  }

  if (timeframe === "1Y") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric"
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatTooltipLabel(value: number, timeframe: TimeframeKey, locale: string) {
  const date = new Date(value);

  if (timeframe === "1D") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  if (timeframe === "7D") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit"
    }).format(date);
  }

  if (timeframe === "1M") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

interface NavTooltipProps {
  active?: boolean;
  label?: number;
  payload?: Array<{ value?: unknown }>;
  currency: string;
  timeframe: TimeframeKey;
  locale: string;
  navLabel: string;
  notAvailableLabel: string;
}

function NavTooltip({
  active,
  label,
  payload,
  currency,
  timeframe,
  locale,
  navLabel,
  notAvailableLabel
}: NavTooltipProps) {
  if (!active || label === undefined || !payload?.length) {
    return null;
  }

  const rawValue = payload[0]?.value;
  const navValue = Array.isArray(rawValue) ? Number(rawValue[0]) : Number(rawValue);

  return (
    <div className="rounded-2xl border border-line bg-[#070b11]/95 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.36)]">
      <p className="text-xs text-mist">{formatTooltipLabel(label, timeframe, locale)}</p>
      <p className="mt-2 mono text-sm text-ink">
        {navLabel} {Number.isFinite(navValue) ? formatCurrency(navValue, currency, undefined, locale) : notAvailableLabel}
      </p>
    </div>
  );
}
