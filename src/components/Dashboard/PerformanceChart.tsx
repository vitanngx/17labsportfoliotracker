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
  formatDateLabel
} from "@/lib/formatters";
import { PortfolioHistoryPoint } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";

interface PerformanceChartProps {
  data: PortfolioHistoryPoint[];
  currency: string;
}

export default function PerformanceChart({
  data,
  currency
}: PerformanceChartProps) {
  return (
    <SectionCard
      title="Portfolio Value"
      subtitle="Base-currency portfolio value with holdings and cash normalized through the FX layer."
      className="chart-shell"
    >
      <div className="h-[320px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-line bg-white/[0.02] text-sm text-mist">
            Add transactions to generate a portfolio history.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="portfolioArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#78C9FF" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#78C9FF" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                minTickGap={32}
                tickFormatter={(value) => formatDateLabel(String(value))}
              />
              <YAxis
                width={100}
                tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(7, 11, 17, 0.96)",
                  border: "1px solid rgba(151, 171, 190, 0.18)",
                  borderRadius: "16px"
                }}
                formatter={(value: number) => formatCurrency(Number(value), currency)}
                labelFormatter={(label) => formatDateLabel(String(label))}
              />
              <Area
                type="monotone"
                dataKey="totalValueBase"
                stroke="#78C9FF"
                strokeWidth={2}
                fill="url(#portfolioArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}
