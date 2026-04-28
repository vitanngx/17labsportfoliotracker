import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import React from "react";
import { AllocationSlice } from "@/types/portfolio";
import { getAssetDisplayName } from "@/lib/assetNames";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import SectionCard from "@/components/Dashboard/SectionCard";

interface AllocationDonutProps {
  title: string;
  subtitle?: string;
  data: AllocationSlice[];
  currency: string;
  className?: string;
  chartHeightClass?: string;
  legendLimit?: number;
}

export default function AllocationDonut({
  title,
  subtitle,
  data,
  currency,
  className = "",
  chartHeightClass = "h-[260px]",
  legendLimit
}: AllocationDonutProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const legendPreviewCount = legendLimit ?? data.length;
  const legendHeightClass = legendPreviewCount <= 5 ? "h-[236px]" : "h-[260px]";

  return (
    <SectionCard title={title} subtitle={subtitle} className={`p-5 md:p-5 ${className}`}>
      <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_230px] xl:items-start">
        <div className={`${chartHeightClass} xl:-mt-2`}>
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-line bg-white/[0.02] text-sm text-mist">
              Allocation will appear after positions or cash balances exist.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={68}
                  outerRadius={98}
                  paddingAngle={3}
                  activeIndex={activeIndex ?? undefined}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {data.map((slice) => (
                    <Cell
                      key={slice.name}
                      fill={slice.color}
                      fillOpacity={activeIndex === null || data[activeIndex]?.name === slice.name ? 1 : 0.42}
                      stroke={activeIndex !== null && data[activeIndex]?.name === slice.name ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)"}
                      strokeWidth={activeIndex !== null && data[activeIndex]?.name === slice.name ? 2.4 : 1.2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(7, 11, 17, 0.96)",
                    border: "1px solid rgba(151, 171, 190, 0.18)",
                    borderRadius: "16px",
                    color: "#edf2f7"
                  }}
                  itemStyle={{ color: "#edf2f7" }}
                  labelStyle={{ color: "#edf2f7" }}
                  cursor={{ fill: "rgba(255, 255, 255, 0.06)" }}
                  formatter={(value: number) => formatCurrency(Number(value), currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className={`min-h-0 overflow-y-auto rounded-2xl border border-line/80 bg-white/[0.015] p-2 ${legendHeightClass}`}>
          <div className="space-y-1.5">
            {data.map((slice, index) => (
              <div
                key={slice.name}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-all ${
                  activeIndex !== null && data[activeIndex]?.name === slice.name
                    ? "border-accent/35 bg-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                    : "border-line bg-white/[0.02] hover:border-accent/25 hover:bg-white/[0.04]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{slice.name}</p>
                    <p className="truncate text-[11px] text-mist">
                      {getAllocationSubLabel(slice.name, slice.weightPct)}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm text-ink">{formatCompactCurrency(slice.value, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function getAllocationSubLabel(name: string, weightPct: number) {
  const normalized = name.trim().toUpperCase();
  const looksLikeAssetSymbol = normalized.includes(".") || normalized.includes("-");

  if (looksLikeAssetSymbol) {
    const displayName = getAssetDisplayName(name);
    return displayName === name
      ? `${weightPct.toFixed(2)}%`
      : `${displayName} • ${weightPct.toFixed(2)}%`;
  }

  return `${weightPct.toFixed(2)}%`;
}
