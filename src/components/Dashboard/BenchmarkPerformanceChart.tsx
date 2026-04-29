"use client";

import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useI18n } from "@/components/I18nProvider";
import { formatPercent } from "@/lib/formatters";
import { TIMEFRAME_CONFIG } from "@/lib/marketData/timeframes";
import {
  BenchmarkKey,
  BenchmarkPerformancePoint,
  BenchmarkPerformanceResponse,
  BenchmarkSeriesInfo,
  TimeframeKey
} from "@/types/portfolio";

const TIMEFRAMES = Object.keys(TIMEFRAME_CONFIG) as TimeframeKey[];

export default function BenchmarkPerformanceChart() {
  const { t, intlLocale } = useI18n();
  const [activeTimeframe, setActiveTimeframe] = React.useState<TimeframeKey>("7D");
  const [chartData, setChartData] = React.useState<BenchmarkPerformancePoint[]>([]);
  const [series, setSeries] = React.useState<BenchmarkSeriesInfo[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const chartSeries = React.useMemo(
    () =>
      chartData.map((point) => ({
        ...point,
        timestamp: new Date(point.date).getTime()
      })),
    [chartData]
  );
  const visibleSeries = series.filter((item) => item.available);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadBenchmarks() {
      setLoading(true);
      setError(null);
      setChartData([]);
      setWarnings([]);

      try {
        const response = await fetch(`/api/portfolio/benchmarks?timeframe=${activeTimeframe}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json()) as BenchmarkPerformanceResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(t("benchmarks.loadError"));
        }

        setChartData(payload.history);
        setSeries(payload.series);
        setWarnings(payload.warnings);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setChartData([]);
        setSeries([]);
        setWarnings([]);
        setError(fetchError instanceof Error ? fetchError.message : t("benchmarks.loadError"));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadBenchmarks();

    return () => {
      controller.abort();
    };
  }, [activeTimeframe, t]);

  return (
    <section className="surface-panel chart-shell flex flex-col rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-title text-mist">{t("benchmarks.title")}</p>
          <p className="mt-2 text-sm text-mist">{t("benchmarks.subtitle")}</p>
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

      {warnings.length > 0 ? (
        <div className="mt-4 truncate text-xs text-mist">{warnings[0]}</div>
      ) : null}

      <div className="mt-4 h-[320px]">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-[18px] border border-line bg-white/[0.02] text-sm text-mist">
            {t("benchmarks.loading", { timeframe: activeTimeframe })}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-line bg-white/[0.02] px-6 text-center text-sm text-mist">
            {error}
          </div>
        ) : chartSeries.length < 2 || visibleSeries.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-line bg-white/[0.02] px-6 text-center text-sm text-mist">
            {t("benchmarks.empty")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartSeries} margin={{ top: 8, right: 20, left: -18, bottom: 0 }}>
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
                tickFormatter={(value) => formatPercent(Number(value), 1, intlLocale)}
              />
              <Tooltip
                cursor={{
                  stroke: "rgba(237, 242, 247, 0.24)",
                  strokeDasharray: "4 4"
                }}
                content={(props) => (
                  <BenchmarkTooltip
                    {...props}
                    locale={intlLocale}
                    timeframe={activeTimeframe}
                    series={visibleSeries}
                  />
                )}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ color: "#98a5b6", fontSize: 12, paddingBottom: 10 }}
              />
              {visibleSeries.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={item.key === "portfolio" ? 2.8 : 2}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#edf2f7" }}
                  isAnimationActive
                  animationDuration={260}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function formatAxisLabel(value: number, timeframe: TimeframeKey, locale: string) {
  const date = new Date(value);

  if (timeframe === "1D") {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit"
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

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

interface BenchmarkTooltipProps {
  active?: boolean;
  label?: number;
  payload?: Array<{ dataKey?: string | number; value?: unknown; color?: string }>;
  locale: string;
  timeframe: TimeframeKey;
  series: BenchmarkSeriesInfo[];
}

function BenchmarkTooltip({
  active,
  label,
  payload,
  locale,
  timeframe,
  series
}: BenchmarkTooltipProps) {
  if (!active || label === undefined || !payload?.length) {
    return null;
  }

  const labels = Object.fromEntries(series.map((item) => [item.key, item.label]));

  return (
    <div className="rounded-2xl border border-line bg-[#070b11]/95 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.36)]">
      <p className="text-xs text-mist">{formatTooltipLabel(label, timeframe, locale)}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((item) => {
          const key = item.dataKey as BenchmarkKey | undefined;
          const value = Number(item.value);

          if (!key || !Number.isFinite(value)) {
            return null;
          }

          return (
            <p key={key} className="flex items-center justify-between gap-5 text-sm">
              <span className="text-mist" style={{ color: item.color }}>
                {labels[key] ?? key}
              </span>
              <span className={value >= 0 ? "text-positive" : "text-negative"}>
                {formatPercent(value, 2, locale)}
              </span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
