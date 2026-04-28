import { formatCurrency } from "@/lib/formatters";
import { CashBalance } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";

interface CashBalancesTableProps {
  cashBalances: CashBalance[];
  className?: string;
}

export default function CashBalancesTable({
  cashBalances,
  className = ""
}: CashBalancesTableProps) {
  const negativeCashBalances = cashBalances.filter((balance) => balance.amount < 0);

  return (
    <SectionCard title="Cash Balances" className={className}>
      {negativeCashBalances.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          Cash deficit detected. Negative cash is treated as borrowed cash or margin used and is already included in net portfolio value.
        </div>
      ) : null}
      <div className="flex-1 overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Base Value</th>
              <th>FX Rate</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {cashBalances.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-mist">
                  No cash balances recorded yet.
                </td>
              </tr>
            ) : (
              cashBalances.map((balance) => (
                <tr key={balance.currency}>
                  <td className="font-medium text-ink">{balance.currency}</td>
                  <td className="text-sm">
                    {balance.amount < 0 ? (
                      <span className="rounded-full border border-negative/30 bg-negative/10 px-2.5 py-1 text-xs font-medium text-negative">
                        Cash deficit
                      </span>
                    ) : (
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-mist">
                        Available cash
                      </span>
                    )}
                  </td>
                  <td className={`mono text-sm ${balance.amount < 0 ? "text-negative" : "text-ink"}`}>
                    {formatCurrency(balance.amount, balance.currency)}
                  </td>
                  <td className={`mono text-sm ${balance.amountBase < 0 ? "text-negative" : "text-ink"}`}>
                    {formatCurrency(balance.amountBase, balance.baseCurrency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {balance.fxRate?.toFixed(6) ?? "1.000000"}
                  </td>
                  <td className={`mono text-sm ${balance.weightPct < 0 ? "text-negative" : "text-ink"}`}>
                    {balance.weightPct.toFixed(2)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
