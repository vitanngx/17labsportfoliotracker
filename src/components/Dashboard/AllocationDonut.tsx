import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AllocationSlice } from "@/types/portfolio";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import SectionCard from "@/components/Dashboard/SectionCard";

interface AllocationDonutProps {
  title: string;
  subtitle: string;
  data: AllocationSlice[];
  currency: string;
}

export default function AllocationDonut({
  title,
  subtitle,
  data,
  currency
}: AllocationDonutProps) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="h-[260px]">
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
                    borderRadius: "16px"
                  }}
                  formatter={(value: number) => formatCurrency(Number(value), currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="space-y-3">
          {data.map((slice) => (
            <div
              key={slice.name}
              className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                <div>
                  <p className="text-sm font-medium text-ink">{slice.name}</p>
                  <p className="text-xs text-mist">{slice.weightPct.toFixed(2)}%</p>
                </div>
              </div>
              <p className="text-sm text-ink">{formatCompactCurrency(slice.value, currency)}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
