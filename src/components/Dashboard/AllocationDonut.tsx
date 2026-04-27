import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AllocationSlice } from "@/types/portfolio";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import SectionCard from "@/components/Dashboard/SectionCard";

interface AllocationDonutProps {
  title: string;
  subtitle: string;
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
  const visibleLegendItems = legendLimit ? data.slice(0, legendLimit) : data;
  const remainingLegendCount = Math.max(data.length - visibleLegendItems.length, 0);

  return (
    <SectionCard title={title} subtitle={subtitle} className={className}>
      <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
        <div className={chartHeightClass}>
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-line bg-white/[0.02] text-sm text-mist">
              Allocation will appear after positions or cash balances exist.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={100} paddingAngle={3}>
                  {data.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
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
        <div className="space-y-2">
          {visibleLegendItems.map((slice) => (
            <div
              key={slice.name}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.02] px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{slice.name}</p>
                  <p className="text-xs text-mist">{slice.weightPct.toFixed(2)}%</p>
                </div>
              </div>
              <p className="shrink-0 text-sm text-ink">{formatCompactCurrency(slice.value, currency)}</p>
            </div>
          ))}
          {remainingLegendCount > 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white/[0.015] px-3.5 py-2.5 text-xs text-mist">
              +{remainingLegendCount} more assets shown in the donut chart
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
